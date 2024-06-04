import { RegisteredContactDoc } from "@/os/explorer/account";
import { DEFAULT_MODEL, openaiClient } from "@/os/lib/llm";
import { createBranch } from "@/os/versionControl/branches";
import { MarkdownDoc } from "@/datatypes/essay/schema";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { splice } from "@automerge/automerge/next";
import { EssayEditingBotDoc } from "./schema";

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
              before: { type: "string" },
              after: { type: "string" },
              reasoning: { type: "string" },
            },
          },
        },
      },
    },
  },
];

export const runBot = async ({
  botDocUrl,
  targetDocHandle,
  repo,
}: {
  botDocUrl: AutomergeUrl;
  targetDocHandle: DocHandle<MarkdownDoc>;
  repo: Repo;
}): Promise<AutomergeUrl> => {
  const botDoc = await repo.find<EssayEditingBotDoc>(botDocUrl).doc();
  const contactDoc = await repo
    .find<RegisteredContactDoc>(botDoc.contactUrl)
    .doc();
  const promptDoc = await repo.find<MarkdownDoc>(botDoc.promptUrl).doc();
  const prompt = promptDoc.content;

  const systemPrompt = `The user will give you some text. Return a list of edits to apply to the text to achieve the task below.
Each edit should have some before text, the corresponding after text, and reasoning for that edit.
In your reasoning, concisely explain in one short sentence why the edit is necessary given the task specification.
Keep your before and after regions short. If you're only editing one word, you only need to include that word.

Task:

${prompt}

Response format:

${JSON.stringify(functionsSpec)}
  `;

  const message = `
  ${targetDocHandle.docSync().content}
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

    const branch = createBranch({
      name: `Edits by ${contactDoc.name}`,
      createdBy: botDoc.contactUrl,
      repo,
      handle: targetDocHandle,
    });

    const branchHandle = repo.find<MarkdownDoc>(branch.url);

    for (const edit of parsed.edits) {
      branchHandle.change(
        (doc) => {
          const from = doc.content.indexOf(edit.before);

          // edit the text
          splice(doc, ["content"], from, edit.before.length, edit.after);

          // leave a comment
          // const fromCursor = getCursor(doc, ["content"], from);
          // const toCursor = getCursor(
          //   doc,
          //   ["content"],
          //   from + edit.after.length
          // );
        },
        { message: JSON.stringify({ author: botDoc.contactUrl }) }
      );
    }

    return branchHandle.url;
  } catch {
    throw new Error(`Failed to parse output: ${output}`);
  }
};
