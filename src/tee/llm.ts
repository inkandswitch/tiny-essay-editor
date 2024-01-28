import { splice } from "@automerge/automerge/next";
import { DocHandle } from "@automerge/automerge-repo";
import OpenAI from "openai";
import { MarkdownDoc } from "./schema";

const SPELLCHECK_CONTACT_URL = "automerge:25h59mDYt9KwnTkifwjw6Nshab7k";

const openai = new OpenAI({
  apiKey: import.meta.env["VITE_OPENAI_API_KEY"],
  dangerouslyAllowBrowser: true,
});

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

export const editText = async (
  prompt: string,
  handle: DocHandle<MarkdownDoc>
): Promise<{ _type: "ok"; result: any } | { _type: "error" }> => {
  const systemPrompt = `${prompt}

Response format:

${JSON.stringify(functionsSpec)}
  `;

  const message = `Here is my document:

  ${handle.docSync().content}
  `;

  console.log(systemPrompt);
  console.log(message);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
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

    const result = {
      _type: "ok",
      result: parsed,
    };

    console.log("parsed", parsed);

    for (const edit of parsed.edits) {
      handle.change(
        (doc) => {
          const from = doc.content.indexOf(edit.before);
          splice(doc, ["content"], from, edit.before.length, edit.after);
        },
        { metadata: { author: SPELLCHECK_CONTACT_URL } }
      );
    }
  } catch {
    console.error("Failed to parse output", output);
    return {
      _type: "error",
    };
  }
};
