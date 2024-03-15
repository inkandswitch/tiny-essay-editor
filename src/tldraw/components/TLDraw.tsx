import { useEffect, useMemo, useRef, useState } from "react";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { isEqual } from "lodash";

import { TLDrawDoc, TLDrawDocAnchor } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import {
  TLCamera,
  TLShapeId,
  TLStoreWithStatus,
  Tldraw,
  Editor,
  Box2d,
  TLShape,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";
import { next as A, Patch } from "@automerge/automerge";
import { AnnotationId, DiffWithProvenance } from "@/patchwork/schema";
import { translateAutomergePatchesToTLStoreUpdates } from "../vendor/automerge-tldraw/AutomergeToTLStore";
import { SideBySideProps } from "@/patchwork/components/PatchworkDocEditor";
import { Annotation, AnnotationPosition } from "@/patchwork/schema";
import { edit } from "react-arborist/dist/module/state/edit-slice";

export const TLDraw = ({
  docUrl,
  docHeads,
  annotations,
  camera,
  onChangeCamera,
  onUpdateAnnotationPositions,
  selection,
  setSelection,
}: {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  annotations?: Annotation<TLDrawDocAnchor, TLShape>[];
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
  onUpdateAnnotationPositions?: (
    positions: AnnotationPosition<TLDrawDocAnchor, TLShape>[]
  ) => void;
  selection: TLDrawDocAnchor;
  setSelection: (selection: TLDrawDocAnchor) => void;
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

  useAnnotationsPositionListener({
    camera: camera ?? localCamera,
    annotations,
    onUpdateAnnotationPositions,
  });

  return (
    <div className="tldraw__editor h-full overflow-auto">
      {docHeads ? (
        docAtHeads ? (
          <ReadOnlyTLDraw
            key={JSON.stringify(docHeads)}
            userId={userId}
            doc={docAtHeads}
            annotations={annotations}
            handle={handle}
            camera={camera ?? localCamera}
            onChangeCamera={setCamera}
            selection={selection}
            setSelection={setSelection}
          />
        ) : null
      ) : (
        <EditableTLDraw
          userId={userId}
          doc={doc}
          annotations={annotations}
          handle={handle}
          camera={camera ?? localCamera}
          onChangeCamera={setCamera}
          selection={selection}
          setSelection={setSelection}
        />
      )}
    </div>
  );
};

interface TlDrawProps {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  userId: string;
  annotations?: Annotation<TLDrawDocAnchor, TLShape>[];
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
  selection?: TLDrawDocAnchor;
  setSelection: (selection: TLDrawDocAnchor) => void;
}

const EditableTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  camera,
  onChangeCamera,
  selection,
  setSelection,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });

  useSelectionListener({ editor, selection, setSelection });

  return <Tldraw autoFocus store={store} onMount={setEditor} />;
};

const ReadOnlyTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  onChangeCamera,
  camera,
  selection,
  setSelection,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });

  useSelectionListener({ editor, selection, setSelection });

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

  // todo: fix side by side
  return null;
  /*<div className="flex h-full w-full">
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
    </div>*/
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

const useAnnotationsPositionListener = ({
  camera,
  annotations,
  onUpdateAnnotationPositions,
}: {
  camera?: TLCamera;
  annotations: Annotation<TLDrawDocAnchor, TLShape>[];
  onUpdateAnnotationPositions?: (
    positions: AnnotationPosition<TLDrawDocAnchor, TLShape>[]
  ) => void;
}) => {
  useEffect(() => {
    const positions: AnnotationPosition<TLDrawDocAnchor, TLShape>[] = [];

    for (const annotation of annotations) {
      if (annotation.type === "highlighted") {
        continue;
      }

      const element = document.getElementById(annotation.target.shapeIds[0]);

      if (element) {
        const { top, right } = element.getBoundingClientRect();
        positions.push({ annotation, x: right, y: top });
      }
    }

    onUpdateAnnotationPositions(positions);
  }, [annotations, camera, onUpdateAnnotationPositions]);
};

const useDiffStyling = ({
  doc,
  annotations,
  store,
  editor,
}: {
  doc: TLDrawDoc;
  annotations: Annotation<TLDrawDocAnchor, TLShape>[];
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

    if (!annotations) {
      store.store.remove(Array.from(tempShapeIdsRef.current));
      highlightedElementsRef.current.forEach((element) => {
        element.style.filter = "";
      });

      tempShapeIdsRef.current = new Set();
      highlightedElementsRef.current = new Set();
      return;
    }

    setTimeout(() => {
      // track which temp shapes and highlighted elements are active in the current diff
      const activeHighlightedElements = new Set<HTMLElement>();
      const activeTempShapeIds = new Set<TLShapeId>();

      annotations.forEach((annotation) => {
        switch (annotation.type) {
          case "added":
            {
              const shapeElem = document.getElementById(annotation.added.id);
              if (!shapeElem) {
                return;
              }

              activeHighlightedElements.add(shapeElem);
              if (highlightedElementsRef.current.has(shapeElem)) {
                return;
              }

              highlightedElementsRef.current.add(shapeElem);
              shapeElem.style.filter = "drop-shadow(0 0 0.75rem green)";
            }
            break;

          case "deleted": {
            activeTempShapeIds.add(annotation.deleted.id);
            if (tempShapeIdsRef.current.has(annotation.deleted.id)) {
              break;
            }

            const deletedShape = annotation.deleted;

            deletedShape.opacity = 0.1;
            deletedShape.isLocked = true;

            activeTempShapeIds.add(deletedShape.id);
            tempShapeIdsRef.current.add(deletedShape.id);
            store.store.put([deletedShape]);

            break;
          }
        }
      }, 100);

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
    });
  }, [annotations, store, doc, camera]);
};

const useSelectionListener = ({
  editor,
  selection,
  setSelection,
}: {
  editor: Editor;
  selection: TLDrawDocAnchor;
  setSelection: (selection: TLDrawDocAnchor) => void;
}) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on("update", () => {
      if (!isEqual(editor?.selectedShapeIds, selection?.shapeIds)) {
        console.log(editor.selectedShapeIds);

        setSelection(
          editor.selectedShapeIds.length > 0
            ? { shapeIds: editor.selectedShapeIds }
            : undefined
        );
      }
    });
  }, [editor]);
};
