import OpenAI from "openai";
import { MarkdownDocActions } from "./MarkdownDoc";

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
            oneof: Object.entries(MarkdownDocActions).map(
              ([actionName, { parameters }]) => ({
                type: "object",
                properties: { action: { const: actionName }, parameters },
              })
            ),
          },
        },
      },
    },
  },
];

// todo: the any type should be the type for editDocument
export const editDocument = async (
  prompt: string,
  document: any
): Promise<{ _type: "ok"; result: any } | { _type: "error" }> => {
  const systemPrompt = `${prompt}

Response format:

${JSON.stringify(functionsSpec)}
  `;

  const message = `Here is my document:

  ${JSON.stringify(document)}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4-0613",
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

    return {
      _type: "ok",
      result: parsed,
    };
  } catch {
    console.error("Failed to parse output", output);
    return {
      _type: "error",
    };
  }
};
