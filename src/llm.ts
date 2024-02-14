import OpenAI from "openai";

export const openaiClient = new OpenAI({
  apiKey: import.meta.env["VITE_OPENAI_API_KEY"],
  dangerouslyAllowBrowser: true,
});

export const DEFAULT_MODEL = "gpt-4-turbo-preview";

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
