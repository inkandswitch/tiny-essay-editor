// A utility type to recursively make an object mutable.
// This helps us take the immutable objects returned by
// the schema library and make them mutable for editing
// within an automerge document.

import { Doc } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { Schema as S } from "@effect/schema";

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

export type LoadDocumentChildProps<T> = {
  doc: Doc<T>;
  changeDoc: (changeFn: (doc: T) => void) => void;
  handle: DocHandle<T>;
};
