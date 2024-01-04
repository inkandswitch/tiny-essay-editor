import { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge/next";
import {
  AutomergeUrl,
  DocHandleChangePayload,
} from "@automerge/automerge-repo";
import { useCallback, useEffect, useState } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { Schema as S } from "@effect/schema";
import { isLeft } from "effect/Either";
import { SchemaToType } from "./schemaToType";

// An experimental version of the automerge-repo useDocument hook
// which has stronger schema validation powered by @effect/schema

export function useTypedDocument<T extends S.Schema<any>>(
  documentUrl: AutomergeUrl | null,
  schema: T
): [
  Doc<SchemaToType<T>> | undefined,
  (changeFn: ChangeFn<SchemaToType<T>>) => void
] {
  const [doc, setDoc] = useState<Doc<SchemaToType<T>>>();
  const repo = useRepo();

  const handle = documentUrl ? repo.find<SchemaToType<T>>(documentUrl) : null;

  const validateDoc = useCallback(
    (doc: unknown): void => {
      const parseResult = S.parseEither(schema)(doc);
      // GL 12/6/23:
      // TODO: Need to think a lot more about what to do with errors here.
      // Should we crash the app and prevent it from loading?
      // Could use effect schema transforms to do a basic cambria thing.
      if (isLeft(parseResult)) {
        //         alert(`⚠️ WARNING: document loaded from repo does not match schema.

        // Proceed at your own risk.

        // ${String(parseResult.left)}`);
        console.error(
          "WARNING: document loaded from repo does not match schema"
        );
        console.error(doc);
        console.error(String(parseResult.left));
      }
    },
    [schema]
  );

  useEffect(() => {
    if (!handle) return;

    handle.doc().then((v) => {
      validateDoc(v);
      setDoc(v);
    });

    const onChange = (h: DocHandleChangePayload<SchemaToType<T>>) => {
      validateDoc(h.doc);
      setDoc(h.doc);
    };
    handle.on("change", onChange);
    const cleanup = () => {
      handle.removeListener("change", onChange);
    };

    return cleanup;
  }, [handle, validateDoc]);

  const changeDoc = (
    changeFn: ChangeFn<SchemaToType<T>>,
    options?: ChangeOptions<SchemaToType<T>> | undefined
  ) => {
    if (!handle) return;
    handle.change(changeFn, options);
  };

  return [doc, changeDoc];
}
