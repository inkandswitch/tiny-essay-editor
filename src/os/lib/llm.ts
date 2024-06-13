import OpenAI from "openai";

export const isLLMActive = import.meta.env["VITE_OPENAI_API_KEY"] !== undefined;

export const openaiClient = isLLMActive
  ? new OpenAI({
      apiKey: import.meta.env["VITE_OPENAI_API_KEY"],
      dangerouslyAllowBrowser: true,
    })
  : undefined;

export const DEFAULT_MODEL = "gpt-4o";

export const getStringCompletion = async (message) => {
  const response = await openaiClient.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
  });
  return response.choices[0].message.content;
};
