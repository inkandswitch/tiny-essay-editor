import { Schema as S } from "@effect/schema";
import { SchemaToType } from "../utils";

export const AutomergeUrl = S.extend(
  S.string,
  S.struct({ __documentUrl: S.literal(true) })
);

type AutomergeUrl = SchemaToType<typeof AutomergeUrl>;

// Now we define a schema for turning a string into a branded Automerge URL
export const AutomergeUrlFromString = S.string.pipe((s) => {
  // @ts-expect-error doing the branded type thing at runtime; TODO fix this to only be erased types
  s.__documentUrl = true;
  return s;
});
