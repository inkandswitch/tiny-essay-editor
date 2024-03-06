import { useEffect, useMemo } from "react";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { StyleProp, T, TLStoreWithStatus, Tldraw } from "@tldraw/tldraw";
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
        <EditableTLDraw
          userId={userId}
          doc={docAtHeads}
          diff={diff}
          handle={handle}
        />
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

  useDiffStyling(diff, store);

  return <Tldraw autoFocus store={store} />;
};

const ReadOnlyTLDraw = ({ doc, handle, userId, diff }: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });

  useDiffStyling(diff, store);

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

function useDiffStyling(diff: DiffWithProvenance, store: TLStoreWithStatus) {
  useEffect(() => {
    if (!diff || !store.store) {
      return;
    }
    setTimeout(() => {
      console.log("diff", diff);
      // TODO: this needs to, like, undo itself... maybe?
      const [toPut, toRemove] = translateAutomergePatchesToTLStoreUpdates(
        diff.patches as Patch[],
        store.store
      );
      toPut.map((obj) => {
        const shapeElem = document.getElementById(obj.id);
        if (!shapeElem) {
          console.log("no shapeElem", obj.id);
          return;
        }
        shapeElem.style.filter = "drop-shadow(0 0 0.75rem green)";
      });
      toRemove.map((id) => {
        const shapeElem = document.getElementById(id);
        if (!shapeElem) {
          console.log("no shapeElem", id);
          return;
        }
        shapeElem.style.filter = "drop-shadow(0 0 0.75rem red)";
      });
      console.log("toRemove", toRemove);
    }, 100);
  }, [diff, store]);
}
