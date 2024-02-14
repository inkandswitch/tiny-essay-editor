import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env["VITE_OPENAI_API_KEY"],
  dangerouslyAllowBrowser: true,
});

export const getStringCompletion = async (message) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
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
