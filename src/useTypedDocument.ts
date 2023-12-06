import { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge/next";
import {
  AutomergeUrl,
  DocHandleChangePayload,
} from "@automerge/automerge-repo";
import { useEffect, useState } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { Schema as S } from "@effect/schema";
import { isLeft, isRight } from "effect/Either";

// An experimental version of the automerge-repo useDocument hook
// which has stronger schema validation powered by @effect/schema

export function useTypedDocument<T extends S.Schema<any>>(
  documentUrl: AutomergeUrl | null,
  schema: T
): [
  Doc<S.Schema.To<T>> | undefined,
  (changeFn: ChangeFn<S.Schema.To<T>>) => void
] {
  type ResultType = S.Schema.To<T>;

  const [doc, setDoc] = useState<Doc<T>>();
  const repo = useRepo();

  const handle = documentUrl ? repo.find<T>(documentUrl) : null;

  const parseSchema = S.parseEither(schema);

  useEffect(() => {
    if (!handle) return;

    handle.doc().then((v) => {
      const parseResult = parseSchema(v);
      // GL 12/6/23:
      // TODO: Need to think a lot more about what to do with errors here.
      // Should we crash the app and prevent it from loading?
      // Could use effect schema transforms to do a basic cambria thing.
      if (isLeft(parseResult)) {
        console.error(
          "WARNING: document loaded from repo does not match schema"
        );
        console.error(v);
        console.error(String(parseResult.left));
      }
      setDoc(v);
    });

    const onChange = (h: DocHandleChangePayload<T>) => setDoc(h.doc);
    handle.on("change", onChange);
    const cleanup = () => {
      handle.removeListener("change", onChange);
    };

    return cleanup;
  }, [handle, parseSchema]);

  const changeDoc = (
    changeFn: ChangeFn<ResultType>,
    options?: ChangeOptions<ResultType> | undefined
  ) => {
    if (!handle) return;
    handle.change(changeFn, options);
  };

  return [doc, changeDoc];
}
