import { Schema as S } from "@effect/schema";
import { EssayV1 } from "./Essay";
import { HasTitleV1 } from "./HasTitle";

// TODO: fix this type error, it's coming from the DeepMutable thing?
// @ts-expect-error DeepMutable issue
export const EssayV1ToHasTitleV1: S.Schema<EssayV1, HasTitleV1> = S.transform(
  EssayV1,
  HasTitleV1,
  (essay) => {
    const frontmatterRegex = /---\n([\s\S]+?)\n---/;
    const frontmatterMatch = essay.content.match(frontmatterRegex);
    const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";

    const titleRegex = /title:\s"(.+?)"/;
    const subtitleRegex = /subtitle:\s"(.+?)"/;

    const titleMatch = frontmatter.match(titleRegex);
    const subtitleMatch = frontmatter.match(subtitleRegex);

    let title = titleMatch ? titleMatch[1] : null;
    const subtitle = subtitleMatch ? subtitleMatch[1] : "";

    // If title not found in frontmatter, find first markdown heading
    if (!title) {
      const titleFallbackRegex = /(^|\n)#\s(.+)/;
      const titleFallbackMatch = essay.content.match(titleFallbackRegex);
      title = titleFallbackMatch ? titleFallbackMatch[2] : "Untitled";
    }

    return { title: `${title} ${subtitle && `: ${subtitle}`}` };
  },

  // this reverse conversion is bogus...
  (title) => ({ content: title.title, commentThreads: {}, users: [] })
);

export const transforms = [EssayV1ToHasTitleV1];

// todo: some kind of general transform function that does auto lookup?
// for now we just statically specify the transforms.
// export const transform = (from: S.Schema<any>, to: S.Schema<any>, doc: SchemaToType<typeof from>) => {
//   const transform = transforms.find((t) => (t.ast.from === from.ast && t.ast.to === to.ast);
//   if (!transform) {
//     throw new Error(`No transform found from ${from} to ${to}`);
//   }
//   return parseSync(transform)(doc)
// };
