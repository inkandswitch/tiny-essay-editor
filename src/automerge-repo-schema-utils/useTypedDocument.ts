import { ChangeFn, ChangeOptions, Doc } from "@automerge/automerge/next";
import {
  AutomergeUrl,
  DocHandle,
  DocHandleChangePayload,
} from "@automerge/automerge-repo";
import { useEffect, useState, useCallback } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { Schema as S } from "@effect/schema";
import { isLeft, Either } from "effect/Either";
import { Either as E } from "effect";
import { SchemaToType } from "./utils";
import { ParseError } from "@effect/schema/ParseResult";

// An experimental version of the automerge-repo useDocument hook
// which has stronger schema validation powered by @effect/schema

type HookResult<T extends S.Schema<any>> =
  | { _tag: "loading"; handle: DocHandle<SchemaToType<T>> }
  | {
      _tag: "error";
      error: ParseError;
    }
  | {
      _tag: "ok";
      doc: Doc<SchemaToType<T>>;
      changeDoc: (changeFn: ChangeFn<SchemaToType<T>>) => void;
      handle: DocHandle<SchemaToType<T>>;
    };

export function useTypedDocument<T extends S.Schema<any>>(
  documentUrl: AutomergeUrl | null,
  schema: T
): HookResult<T> {
  const repo = useRepo();
  const handle = documentUrl ? repo.find<SchemaToType<T>>(documentUrl) : null;
  const [result, setResult] = useState<HookResult<T>>({
    _tag: "loading",
    handle: handle,
  });

  const processNewDoc = useCallback(
    (doc: Doc<SchemaToType<T>>) => {
      const parseResult = S.parseEither(schema)(doc);
      if (isLeft(parseResult)) {
        setResult({ _tag: "error", error: parseResult.left });
      } else {
        setResult(() => ({
          _tag: "ok",
          doc: doc,
          changeDoc: (changeFn) => {
            handle.change(changeFn);
          },
          handle,
        }));
      }
    },
    [schema, handle]
  );

  useEffect(() => {
    if (!handle) return;

    handle.doc().then((v) => {
      processNewDoc(v);
    });

    const onChange = (h: DocHandleChangePayload<SchemaToType<T>>) => {
      processNewDoc(h.doc);
    };
    handle.on("change", onChange);
    const cleanup = () => {
      handle.removeListener("change", onChange);
    };

    return cleanup;
  }, [handle, processNewDoc]);

  return result;
}
