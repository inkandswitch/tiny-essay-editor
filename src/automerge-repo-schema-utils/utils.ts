// A utility type to recursively make an object mutable.
// This helps us take the immutable objects returned by
// the schema library and make them mutable for editing
// within an automerge document.

import { Doc } from "@automerge/automerge";
import { DocHandle, Repo } from "@automerge/automerge-repo";
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

export type AutomergeClassToDocType<T extends AutomergeClass<any>> =
  SchemaToType<T["schema"]>;

// somehow we need to get the original schema
// export const openAs(doc, newSchema) => ...

// we want to say:
// const { title } = convert(Essay, HasTitle)(doc)

export type LoadDocumentChildProps<T> = {
  doc: Doc<T>;
  changeDoc: (changeFn: (doc: T) => void) => void;
  handle: DocHandle<T>;
};

export type ActionSpec<T> = {
  name: string;
  description: string;
  run: (doc: T, params: any) => void;
  parameters: {
    type: "object";
    properties: {
      // TODO: this should support arbitrary JSON schema as input parameters.
      // The only reason I haven't done that yet is that my UI form logic is dumb and simple.
      // We can switch to a generic JSON schema form builder maybe,
      // and also use the typescript types from that here.
      // or, better -- switch to effect schema here!
      [key: string]: {
        type: "string" | "number" | "boolean";
        description: string;
      };
    };
  };
};

// todo: turn this into a Javascript class?
// Essay could inherit from it?
export type AutomergeClass<S extends S.Schema<any>> = {
  schema: S;

  /** Populate a blank doc with initial default data fitting a schema */
  init: (doc: SchemaToType<S>) => void;

  /** Get the title of the document */
  getTitle: (doc: SchemaToType<S>) => string;

  /** List out actions which can be performed on this document. */
  actions: { [key: string]: ActionSpec<SchemaToType<S>> };

  /** Provide ways to convert the document to various file formats. */
  fileExports: { [key: string]: (doc: SchemaToType<S>) => Blob };

  /** Mark the document as a copy of another document. */
  markAsCopy: (doc: SchemaToType<S>) => void;
};

export function createDocument<T extends AutomergeClass<any>>(
  repo: Repo,
  schema: T
): DocHandle<AutomergeClassToDocType<T>> {
  const handle = repo.create<AutomergeClassToDocType<T>>();
  handle.change(schema.init);
  return handle;
}
