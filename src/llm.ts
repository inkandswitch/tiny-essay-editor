import { Patch } from "@automerge/automerge";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env["VITE_OPENAI_API_KEY"],
  dangerouslyAllowBrowser: true,
});

const patchToString = (patch: Patch): string => {
  if (patch.path[0] !== "content" || patch.path.length !== 2) {
    return "";
  }
  switch (patch.action) {
    case "splice": {
      if (patch.value.length > 0) {
        return `insert at index ${patch.path[1]}: ${patch.value}`;
      } else {
        return "";
      }
    }
    case "del": {
      return `delete at index ${patch.path[1]}: ${patch.length ?? 1} character`;
    }
    default: {
      return "";
    }
  }
};

const SYSTEM_PROMPT = `Write a brief message in Markdown describing the changes made between the two drafts of a document below.

Input format:
You'll get two drafts of a document, before and after.
You'll also get a list of changes between the two drafts.

Output format:
If there are major changes, write a a bolded header, ~8 words max, and then a few bullet points, ~10 words max each, with more detail.
If the changes all happened in one section of the document, mention that, e.g. "Major edits to Motivation section"
If there are a few minor changes, just briefly summarize in the header, e.g. "Minor edits: typos / links.". Don't add more bullets.
If there's just one minor change, explain the change in the header, e.g. "Fixed a link." Don't add more bullets.
If there are no changes, just say "No changes."
Do not mention the title of the document anywhere in your message; the user already knows you're talking about this document.
Don't quote directly from the document.
The message should be short if few changes were made.
Be concise!
`;

export const summarizeChanges = async (
  before: string,
  after: string,
  diff: Patch[]
): Promise<string> => {
  const message = `
---

BEFORE:

${before}

---

AFTER:

${after}

---

DIFF:

${diff.map((patch) => patchToString(patch)).join("\n")}

---
  `;

  // console.log(message);

  const response = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: message,
      },
    ],
  });

  return response.choices[0].message?.content as string;
};
