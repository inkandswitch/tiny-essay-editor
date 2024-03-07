import { useEffect, useMemo, useRef } from "react";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import {
  StyleProp,
  TLShapeId,
  TLStoreWithStatus,
  Tldraw,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";
import { next as A, Patch } from "@automerge/automerge";
import { DiffWithProvenance } from "@/patchwork/schema";
import { translateAutomergePatchesToTLStoreUpdates } from "../vendor/automerge-tldraw/AutomergeToTLStore";

const changeStyle = StyleProp.defineEnum("example:rating", {
  defaultValue: "unchanged",
  values: ["unchanged", "added", "removed", "changed"],
});

export const TLDraw = ({
  docUrl,
  heads,
  diff,
}: {
  docUrl: AutomergeUrl;
  heads?: A.Heads;
  diff?: DiffWithProvenance;
}) => {
  useDocument<TLDrawDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  const [doc] = useDocument<TLDrawDoc>(docUrl);
  const docAtHeads = useMemo(
    () => (heads ? A.view(doc, heads) : undefined),
    [doc, heads]
  );

  return (
    <div className="tldraw__editor h-full overflow-auto">
      {heads ? (
        docAtHeads ? (
          <ReadOnlyTLDraw
            key={JSON.stringify(heads)}
            userId={userId}
            doc={docAtHeads}
            diff={diff}
            handle={handle}
          />
        ) : null
      ) : (
        <EditableTLDraw userId={userId} doc={doc} diff={diff} handle={handle} />
      )}
    </div>
  );
};

interface TlDrawProps {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  userId: string;
  diff?: DiffWithProvenance;
}

const EditableTLDraw = ({ doc, handle, userId, diff }: TlDrawProps) => {
  const store = useAutomergeStore({ handle, userId });

  useDiffStyling(doc, diff, store);

  return <Tldraw autoFocus store={store} />;
};

const ReadOnlyTLDraw = ({ doc, handle, userId, diff }: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });

  useDiffStyling(doc, diff, store);

  return (
    <Tldraw
      store={store}
      autoFocus
      onMount={(editor) => {
        editor.updateInstanceState({ isReadonly: true });
      }}
    />
  );
};

function useDiffStyling(
  doc: TLDrawDoc,
  diff: DiffWithProvenance,
  store: TLStoreWithStatus
) {
  const tempShapeIdsRef = useRef(new Set<TLShapeId>());
  const highlightedElementsRef = useRef(new Set<HTMLElement>());

  useEffect(() => {
    if (!store.store) {
      return;
    }

    if (!diff) {
      store.store.remove(Array.from(tempShapeIdsRef.current));
      highlightedElementsRef.current.forEach((element) => {
        element.style.filter = "";
        element.classList.remove("new-shape");
      });

      tempShapeIdsRef.current = new Set();
      highlightedElementsRef.current = new Set();
      return;
    }

    setTimeout(() => {
      const prevDoc = A.view(doc, diff.fromHeads);

      // track which temp shapes and highlighted elements are active in the current diff
      const activeHighlightedElements = new Set<HTMLElement>();
      const activeTempShapeIds = new Set<TLShapeId>();

      const [toPut, toRemove] = translateAutomergePatchesToTLStoreUpdates(
        diff.patches as Patch[],
        store.store
      );

      toPut.forEach((obj) => {
        const shapeElem = document.getElementById(obj.id);
        if (!shapeElem) {
          console.log("no shapeElem", obj.id);
          return;
        }

        activeHighlightedElements.add(shapeElem);
        if (highlightedElementsRef.current.has(shapeElem)) {
          return;
        }

        highlightedElementsRef.current.add(shapeElem);
        shapeElem.style.filter = "drop-shadow(0 0 0.75rem green)"; // add style for "new" element here
        shapeElem.classList.add("new-shape");
      });

      toRemove.forEach((id) => {
        activeTempShapeIds.add(id as TLShapeId);
        if (tempShapeIdsRef.current.has(id as TLShapeId)) {
          return;
        }

        const deletedShape = JSON.parse(
          JSON.stringify(prevDoc.store[id])
        ) as any;

        deletedShape.opacity = 0.1;
        deletedShape.isLocked = true;

        activeTempShapeIds.add(deletedShape.id);
        tempShapeIdsRef.current.add(deletedShape.id);
        store.store.put([deletedShape]);
      });

      // delete shapes that are not part of the current diff
      store.store.remove(
        Array.from(tempShapeIdsRef.current).filter(
          (id) => !activeTempShapeIds.has(id)
        )
      );
      tempShapeIdsRef.current = activeTempShapeIds;

      // remove highlights that are not part of the current diff
      Array.from(highlightedElementsRef.current)
        .filter((element) => !activeHighlightedElements.has(element))
        .forEach((element) => {
          console.log("reset");
          element.classList.remove("new-shape");
          element.style.filter = "";
        });
      highlightedElementsRef.current = activeHighlightedElements;
    }, 100);
  }, [diff, store, doc]);
}
