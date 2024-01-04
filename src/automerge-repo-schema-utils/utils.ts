// A utility type to recursively make an object mutable.
// This helps us take the immutable objects returned by
// the schema library and make them mutable for editing
// within an automerge document.

import { Schema as S } from "@effect/schema";

export type AutomergeSchema<T> = {
  schema: T;

  // semantic actions
  // name?
};

type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends (infer R)[]
    ? DeepMutable<R>[]
    : T[K] extends ReadonlyArray<infer R>
    ? DeepMutable<R>[]
    : T[K] extends object
    ? DeepMutable<T[K]>
    : T[K];
};

export type SchemaToType<T extends S.Schema<any>> = DeepMutable<S.Schema.To<T>>;

// somehow we need to get the original schema
// export const openAs(doc, newSchema) => ...

// we want to say:
// const { title } = convert(Essay, HasTitle)(doc)
