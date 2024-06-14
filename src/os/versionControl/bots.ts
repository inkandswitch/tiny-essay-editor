import { DEFAULT_MODEL, openaiClient } from "@/os/lib/llm";
import { MarkdownDoc } from "@/packages/essay";
import { DocHandle } from "@automerge/automerge-repo";
import { Doc, splice } from "@automerge/automerge/next";
import { DataType } from "../datatypes";

const EDITOR_BOT_CONTACT_URL = "automerge:QprGUET1kXHD76mMmg7p7Q9TD1R";

const functionsSpec = [
  {
    name: "editDocument",
    description: "Apply a series of edits to the document",
    parameters: {
      type: "object",
      properties: {
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
];

// given a path like ["content", "main"], get doc.content.main
const getPath = (doc: Doc<unknown>, path: string[]) => {
  return path.reduce((acc, key) => acc[key], doc);
};

const DATATYPE_CONFIGS = {
  essay: {
    instructions: `The user will give you some text. Return a list of edits to apply to the text to achieve the task below.
In your reasoning, concisely explain in a short sentence why the edit is necessary given the task specification.
Keep your before and after regions short. If you're only editing one word, you only need to include that word.`,
    path: ["content"],
  },
  pkg: {
    instructions: `The user will provide code for a widget which uses React for UI (without JSX) and Automerge for state.
  Edit the code to achieve the user's requested task below.
  Return a list of edits to apply to the code.
  Each edit should have reasoning for that edit, some before text, and the corresponding after text.
  If there are todo comments try to address them and remove them if you resolved them.
  `,
    path: ["source", "index.js", "contents"],
  },
};

export const SUPPORTED_DATATYPES = Object.keys(DATATYPE_CONFIGS);

export const makeBotTextEdits = async ({
  targetDocHandle,
  prompt,
  dataType,
}: {
  targetDocHandle: DocHandle<MarkdownDoc>;
  prompt: string;
  dataType: DataType<unknown, unknown, unknown>;
}): Promise<string> => {
  const { instructions, path } = DATATYPE_CONFIGS[dataType.id];
  const systemPrompt = `${instructions}

Task:

${prompt}

Response format:

${JSON.stringify(functionsSpec)}
  `;

  const message = `
  ${getPath(targetDocHandle.docSync(), path)}
  `;

  const response = await openaiClient.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: message,
      },
    ],
    functions: functionsSpec,
    function_call: { name: "editDocument" },
  });

  const output = response.choices[0].message;

  if (!output.function_call) {
    throw new Error("it was supposed to do a function call deterministically");
  }

  try {
    const parsed: any = JSON.parse(output.function_call.arguments);

    for (const edit of parsed.edits) {
      targetDocHandle.change(
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
    const message =
      output.content ?? `OK, I made ${parsed.edits.length} edits.`;

    return message;
  } catch {
    throw new Error(`Failed to parse output: ${output}`);
  }
};
