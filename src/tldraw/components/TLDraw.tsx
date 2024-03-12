import { useEffect, useMemo, useRef, useState } from "react";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { isEqual } from "lodash";

import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import {
  TLCamera,
  TLShapeId,
  TLStoreWithStatus,
  Tldraw,
  Editor,
  Box2d,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";
import { next as A, Patch } from "@automerge/automerge";
import { DiffWithProvenance } from "@/patchwork/schema";
import { translateAutomergePatchesToTLStoreUpdates } from "../vendor/automerge-tldraw/AutomergeToTLStore";
import { SideBySideProps } from "@/patchwork/components/PatchworkDocEditor";

export const TLDraw = ({
  docUrl,
  docHeads,
  diff,
  camera,
  onChangeCamera,
}: {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  diff?: DiffWithProvenance;
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
}) => {
  useDocument<TLDrawDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  const [doc] = useDocument<TLDrawDoc>(docUrl);
  const docAtHeads = useMemo(
    () => (docHeads ? A.view(doc, docHeads) : undefined),
    [doc, docHeads]
  );

  const [localCamera, setLocalCamera] = useState<TLCamera>();

  const setCamera = (camera: TLCamera) => {
    if (onChangeCamera) {
      onChangeCamera(camera);
      return;
    }

    setLocalCamera(camera);
  };

  return (
    <div className="tldraw__editor h-full overflow-auto">
      {docHeads ? (
        docAtHeads ? (
          <ReadOnlyTLDraw
            key={JSON.stringify(docHeads)}
            userId={userId}
            doc={docAtHeads}
            diff={diff}
            handle={handle}
            camera={camera ?? localCamera}
            onChangeCamera={setCamera}
          />
        ) : null
      ) : (
        <EditableTLDraw
          userId={userId}
          doc={doc}
          diff={diff}
          handle={handle}
          camera={camera ?? localCamera}
          onChangeCamera={setCamera}
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
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
}

const EditableTLDraw = ({
  doc,
  handle,
  userId,
  diff,
  camera,
  onChangeCamera,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, diff, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });

  return <Tldraw autoFocus store={store} onMount={setEditor} />;
};

const ReadOnlyTLDraw = ({
  doc,
  handle,
  userId,
  diff,
  onChangeCamera,
  camera,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, diff, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });

  return (
    <Tldraw
      store={store}
      autoFocus
      onMount={(editor) => {
        setEditor(editor);
        editor.updateInstanceState({ isReadonly: true });
      }}
    />
  );
};

export const SideBySide = ({
  docUrl,
  mainDocUrl,
  docHeads,
  mainDiff,
}: SideBySideProps<unknown, unknown>) => {
  const [camera, setCamera] = useState<TLCamera>();

  return (
    <div className="flex h-full w-full">
      <div className="h-full flex-1 overflow-auto">
        <TLDraw
          docUrl={mainDocUrl}
          diff={mainDiff}
          key={mainDocUrl}
          camera={camera}
          onChangeCamera={setCamera}
        />
      </div>
      <div className="h-full flex-1 overflow-auto border-l border-l-gray-200">
        <TLDraw
          docUrl={docUrl}
          key={docUrl}
          docHeads={docHeads}
          camera={camera}
          onChangeCamera={setCamera}
        />
      </div>
    </div>
  );
};

const useCameraSync = ({
  camera: camera,
  onChangeCamera: onChangeCamera,
  editor,
}: {
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
  editor: Editor;
}) => {
  useEffect(() => {
    if (!editor || !camera || isEqual(editor.camera, camera)) {
      return;
    }

    editor.setCamera(camera);
  }, [editor, camera]);

  useEffect(() => {
    if (!editor || !onChangeCamera) {
      return;
    }

    const onChange = () => {
      if (editor.cameraState === "moving") {
        onChangeCamera(editor.camera);
      }
    };

    editor.on("change", onChange);

    return () => {
      editor.off("change", onChange);
    };
  }, [editor, onChangeCamera]);
};

const useDiffStyling = ({
  doc,
  diff,
  store,
  editor,
}: {
  doc: TLDrawDoc;
  diff: DiffWithProvenance;
  store: TLStoreWithStatus;
  editor: Editor;
}) => {
  const tempShapeIdsRef = useRef(new Set<TLShapeId>());
  const highlightedElementsRef = useRef(new Set<HTMLElement>());
  const [camera, setCamera] = useState<TLCamera>();

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on("change", () => {
      if (editor.cameraState === "moving") {
        setCamera(editor.camera);
      }
    });

    return () => {};
  }, [editor]);

  useEffect(() => {
    if (!store.store) {
      return;
    }

    if (!diff) {
      store.store.remove(Array.from(tempShapeIdsRef.current));
      highlightedElementsRef.current.forEach((element) => {
        element.style.filter = "";
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
          return;
        }

        activeHighlightedElements.add(shapeElem);
        if (highlightedElementsRef.current.has(shapeElem)) {
          return;
        }

        highlightedElementsRef.current.add(shapeElem);
        shapeElem.style.filter = "drop-shadow(0 0 0.75rem green)";
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
          element.style.filter = "";
        });
      highlightedElementsRef.current = activeHighlightedElements;
    }, 100);
  }, [diff, store, doc, camera]);
};
