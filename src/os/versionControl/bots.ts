import { DEFAULT_MODEL, openaiClient } from "@/os/lib/llm";
import { MarkdownDoc } from "@/packages/essay";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Doc, splice } from "@automerge/automerge/next";
import { DataType } from "../datatypes";
import { createBranch } from "./branches";
import { Branch, HasVersionControlMetadata } from "./schema";

// These types are a superset of OpenAI's API so we can directly store a chat history
// and pass it to OpenAI without further modification.

export type UserMessage = { role: "user"; content: string };
export type AssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  branchUrl: AutomergeUrl;
};
export type ToolMessage = {
  role: "tool";
  content: string;
  tool_call_id: string;
};

export type ChatMessage = UserMessage | AssistantMessage | ToolMessage;

const EDITOR_BOT_CONTACT_URL =
  "automerge:QprGUET1kXHD76mMmg7p7Q9TD1R" as AutomergeUrl;

const toolsSpec = [
  {
    type: "function" as const,
    function: {
      name: "editDocument",
      description: "Apply a series of edits to the document",
      parameters: {
        type: "object",
        properties: {
          commitMessage: { type: "string" },
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                reasoning: { type: "string" },
                before: { type: "string" },
                after: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
];

// given a path like ["content", "main"], get doc.content.main
const getPath = (doc: Doc<unknown>, path: string[]) => {
  return path.reduce((acc, key) => acc[key], doc);
};

const DATATYPE_CONFIGS = {
  essay: {
    instructions: `The user will give you some text. Return a list of edits to apply to the text to achieve the task below.
In your reasoning, concisely explain in a short sentence why the edit is necessary given the task specification.
Keep your before and after regions short. If you're only editing one word, you only need to include that word.
Include a short commit message of 2-8 words summarizing the change in specific terms.`,
    path: ["content"],
  },
  pkg: {
    instructions: `The user will provide code for a widget which uses React for UI (without JSX) and Automerge for state.
  Edit the code to achieve the user's requested task below.
  Return a list of edits to apply to the code.
  Each edit should have reasoning for that edit, some before text, and the corresponding after text.
  If there are todo comments try to address them and remove them if you resolved them.
  Include a short commit message of 2-8 words summarizing the change in specific terms
  `,
    path: ["source", "index.js", "contents"],
  },
};

export const SUPPORTED_DATATYPES = Object.keys(DATATYPE_CONFIGS);

export const makeBotTextEdits = async ({
  targetDocHandle,
  chatHistory,
  dataType,
  repo,
}: {
  targetDocHandle: DocHandle<MarkdownDoc>;
  chatHistory: ChatMessage[];
  dataType: DataType<unknown, unknown, unknown>;
  repo: Repo;
}): Promise<Branch> => {
  const { instructions, path } = DATATYPE_CONFIGS[dataType.id];

  const messages = [
    {
      role: "system",
      content: `${instructions}
If you call a tool, only make a single call.`,
    },
    ...chatHistory,
    {
      role: "user",
      content: `Current document contents:
${getPath(targetDocHandle.docSync(), path)}`,
    },
  ];

  const response = await openaiClient.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    // @ts-expect-error I don't understand what's wrong with the input here...
    messages,
    tools: toolsSpec,
    tool_choice: "required",
  });

  const assistantMessage = response.choices[0].message;

  try {
    // const parsed: any = JSON.parse(output.function_call.arguments);
    const parsed: any = JSON.parse(
      assistantMessage.tool_calls[0].function.arguments
    );

    if (!assistantMessage.content) {
      assistantMessage.content = `Made ${parsed.edits.length} edits.`;
    }

    // The chat updates need to happen on the main doc before we branch,
    // so that they're available on both the main doc and the branch
    // whether we merge the branch or not
    targetDocHandle.change((d) => {
      d.botChatHistory.push(assistantMessage as AssistantMessage);
    });
    for (const toolCall of assistantMessage.tool_calls) {
      targetDocHandle.change((d) => {
        d.botChatHistory.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "OK",
        });
      });
    }

    // Now we create a new branch to hold the edits
    const branch = createBranch({
      name: parsed.commitMessage,
      createdBy: EDITOR_BOT_CONTACT_URL,
      repo,
      handle: targetDocHandle,
    });

    const branchHandle = repo.find<HasVersionControlMetadata<unknown, unknown>>(
      branch.url
    );

    // This is some gross stuff because we don't have cherry-picking --
    // We need to update the branchurl on the last message on both the main doc and branch.
    // This is because we can't know the branch URL until we create the branch,
    // but we want the branch URL to exist on both the main doc and the branch even if
    // the branch is never merged. So we just do the change on both docs.
    const updateBranchUrlForAssistantMessage = (docHandle) => {
      docHandle.change((d) => {
        const lastAssistantMessage = d.botChatHistory
          .slice()
          .reverse()
          .find((msg) => msg.role === "assistant") as AssistantMessage;
        if (lastAssistantMessage) {
          lastAssistantMessage.branchUrl = branch.url;
        }
      });
    };
    updateBranchUrlForAssistantMessage(targetDocHandle);
    updateBranchUrlForAssistantMessage(branchHandle);

    for (const edit of parsed.edits) {
      branchHandle.change(
        (doc) => {
          const from = getPath(doc, path).indexOf(edit.before);

          // edit the text
          splice(doc, path, from, edit.before.length, edit.after);

          // leave a comment
          // const fromCursor = getCursor(doc, ["content"], from);
          // const toCursor = getCursor(
          //   doc,
          //   ["content"],
          //   from + edit.after.length
          // );
        },
        { message: JSON.stringify({ author: EDITOR_BOT_CONTACT_URL }) }
      );
    }

    return branch;
  } catch (e) {
    console.error(e);
    throw new Error(`Failed to parse output: ${assistantMessage}`);
  }
};
