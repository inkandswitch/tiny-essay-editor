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

const SYSTEM_PROMPT = `You are an expert essay editor. Given an essay and a style guide, you write comments on specific parts of the essay noting where it could be improved to follow the style guide. You always start by citing a specific item from the style guide.

Some examples:

text: these techniques are too weak to handle complex workflows like planning travel
comment: Make no claims without support: What evidence is there for this claim? Could you perhaps add an aside with an example?

text: computational outliner
comment: Explain jargon: Computational outliner is borderline jargon, and redundant with the rest of the sentence.

text: we demonstrate that these primitives are simple yet powerful enough to prove useful with real tasks
comment: Be humble and transparent about shortcomings and problems: This makes it sound like the system has no flaws, can you add a brief note on limitations?

---

Style guide:

Our publications follow what we call “academish” voice. We follow a largely academic style in our writing but avoid certain academic tendencies.

* Make no claims without support. If you have made an unsupported claim consider its centrality to your argument. If “many developers agree”, we should be able to link to a source or describe how we know that. If you can’t defend it, you should get rid of it.$
* Avoid absolutist language. It’s not “the main problem”, it’s “a problem”. (Unless, of course, you can defend the claim.)
* Be precise and specific with your descriptions. Instead of saying something “feels great”, describe how it feels. Don’t say something “is a problem” unless you describe what the problem is or to whom. If you’re tempted to say something vague because you’re not sure, either do enough research until you’re sure, or don’t say it.
* Avoid hyperbole. Use adjectives to add precision, not to persuade. Claiming “immense benefits” is only appropriate if you have developed a commercially viable fusion power plant. Delete words that are only for emphasis, and keep only those that add substance (e.g. quantify).
* Structure your writing for incremental reading. Don’t bury the lede. A reader should be able to understand the goals and conclusions of an essay by reading the first couple of paragraphs. Individual sections should briefly reiterate any important material and/or link back to where it is introduced. This may feel repetitive at times but aids readers who take several sessions to read a piece or who jump straight to the sections that interest them.
* Give credit to others. Cite earlier work. Link to sources for terms and ideas. Give thanks to contributors, reviewers, and advisors.
* Be humble and transparent about shortcomings and problems. We want readers to build on our work, not buy our product.
* Explain jargon. Academic writing is dense with domain terminology because it assumes readers are “up to date on the field.” Ink & Switch Essays make use of marginalia in what we call “asides” to define uncommon terminology. Concretely, you don’t need to gloss “HTML”, but you should probably gloss “CRDT”.
* Carefully consider section headings. Headings should legibly communicate the shape of the essay and serve as a roadmap for a reader to skip to the part of an essay that’s most interesting to them. Similarly, avoid including unrelated material in a section with a particular title. If a user already knows “How CRDTs Work” then they shouldn’t miss (much) important information about the project by skipping reading that section.
* It’s okay to share hunches and beliefs as long as they’re appropriately labeled. Don’t be shy about drawing conclusions, just be clear about the degree of confidence you have and where it comes from.
* Keep it classy. We don’t dismiss other people’s work or insult their products. Everything around you was made by someone working really hard on it. If we have found a better way, we should show gratitude to those who helped us realize the path forward and humility about our contributions.

---

Response format:

${JSON.stringify(functionsSpec)}

`;

// todo: the any type should be the type for editDocument
export const editDocument = async (
  contents: string
): Promise<{ _type: "ok"; result: any } | { _type: "error" }> => {
  const message = `Here is my essay:

  ${contents}
  `;

  console.log(SYSTEM_PROMPT);

  const response = await openai.chat.completions.create({
    model: "gpt-4-0613",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
