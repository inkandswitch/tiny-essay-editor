import { DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { isEqual } from "lodash";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCurrentAccount } from "@/DocExplorer/account";
import { DocEditorProps } from "@/DocExplorer/doctypes";
import { SideBySideProps } from "@/patchwork/components/PatchworkDocEditor";
import { Annotation, AnnotationPosition } from "@/patchwork/schema";
import { next as A } from "@automerge/automerge";
import {
  Editor,
  TLCamera,
  TLShape,
  TLShapeId,
  TLStoreWithStatus,
  Tldraw,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { TLDrawDoc, TLDrawDocAnchor } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { areAnchorSelectionsEqual } from "@/patchwork/utils";

interface TLDrawProps extends DocEditorProps<TLDrawDocAnchor, TLShape> {
  camera?: TLCamera;
  onChangeCamera?: (camera: TLCamera) => void;
}

export const TLDraw = ({
  docUrl,
  docHeads,
  annotations,
  camera,
  onChangeCamera,
  selectedAnchors,
  hoveredAnchor,
  setSelectedAnchors,
  setHoveredAnchor,
}: TLDrawProps) => {
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
            annotations={annotations}
            handle={handle}
            camera={camera ?? localCamera}
            onChangeCamera={setCamera}
            selectedAnchors={selectedAnchors}
            hoveredAnchor={hoveredAnchor}
            setSelectedAnchors={setSelectedAnchors}
            setHoveredAnchor={setHoveredAnchor}
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
          selectedAnchors={selectedAnchors}
          hoveredAnchor={hoveredAnchor}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
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
  selectedAnchors: TLDrawDocAnchor[];
  setSelectedAnchors: (anchors: TLDrawDocAnchor[]) => void;
  hoveredAnchor: TLDrawDocAnchor;
  setHoveredAnchor: (anchor: TLDrawDocAnchor) => void;
}

const EditableTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  camera,
  onChangeCamera,
  selectedAnchors,
  setSelectedAnchors,
  hoveredAnchor,
  setHoveredAnchor,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor, selectedAnchors });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });
  useAnchorEventListener({
    editor,
    selectedAnchors,
    setSelectedAnchors,
    hoveredAnchor,
    setHoveredAnchor,
  });

  return <Tldraw autoFocus store={store} onMount={setEditor} />;
};

const ReadOnlyTLDraw = ({
  doc,
  handle,
  userId,
  annotations,
  onChangeCamera,
  camera,
  selectedAnchors,
  setSelectedAnchors,
  hoveredAnchor,
  setHoveredAnchor,
}: TlDrawProps) => {
  const store = useAutomergeStore({ handle, doc, userId });
  const [editor, setEditor] = useState<Editor>();

  useDiffStyling({ doc, annotations, store, editor, selectedAnchors });
  useCameraSync({
    editor,
    onChangeCamera,
    camera,
  });
  useAnchorEventListener({
    editor,
    selectedAnchors,
    setSelectedAnchors,
    hoveredAnchor,
    setHoveredAnchor,
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
  annotations,
  selectedAnchors,
  hoveredAnchor,
  setSelectedAnchors,
  setHoveredAnchor,
}: SideBySideProps<unknown, unknown>) => {
  const [camera, setCamera] = useState<TLCamera>();

  return (
    <div className="flex h-full w-full">
      <div className="h-full flex-1 overflow-auto">
        <TLDraw
          docUrl={mainDocUrl}
          key={mainDocUrl}
          annotations={[]}
          camera={camera}
          onChangeCamera={setCamera}
          hoveredAnchor={hoveredAnchor as TLDrawDocAnchor}
          selectedAnchors={selectedAnchors as TLDrawDocAnchor[]}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
        />
      </div>
      <div className="h-full flex-1 overflow-auto border-l border-l-gray-200">
        <TLDraw
          docUrl={docUrl}
          docHeads={docHeads}
          key={mainDocUrl}
          annotations={annotations as Annotation<TLDrawDocAnchor, TLShape>[]}
          camera={camera}
          onChangeCamera={setCamera}
          hoveredAnchor={hoveredAnchor as TLDrawDocAnchor}
          selectedAnchors={selectedAnchors as TLDrawDocAnchor[]}
          setSelectedAnchors={setSelectedAnchors}
          setHoveredAnchor={setHoveredAnchor}
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
  annotations,
  store,
  editor,
  selectedAnchors,
}: {
  doc: TLDrawDoc;
  annotations: Annotation<TLDrawDocAnchor, TLShape>[];
  store: TLStoreWithStatus;
  editor: Editor;
  selectedAnchors: TLDrawDocAnchor[];
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
          case "highlighted":
          case "added":
            {
              const id =
                annotation.type === "highlighted"
                  ? annotation.value.id
                  : annotation.added.id;

              const shapeElem = document.getElementById(id);
              if (!shapeElem) {
                return;
              }

              activeHighlightedElements.add(shapeElem);
              if (!highlightedElementsRef.current.has(shapeElem)) {
                highlightedElementsRef.current.add(shapeElem);
              }

              // don't override styling if element is already highlighted
              // if an element is both added and highlighted we show the hightlighted state
              if (
                shapeElem.style.filter === "drop-shadow(0 0 0.75rem yellow)"
              ) {
                return;
              }

              shapeElem.style.filter = `drop-shadow(0 0 0.75rem ${
                annotation.type === "highlighted" ? "yellow" : "green"
              })`;
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

const useAnchorEventListener = ({
  editor,
  selectedAnchors,
  hoveredAnchor,
  setSelectedAnchors,
  setHoveredAnchor,
}: {
  editor: Editor;
  selectedAnchors: TLDrawDocAnchor[];
  setSelectedAnchors: (anchors: TLDrawDocAnchor[]) => void;
  hoveredAnchor: TLDrawDocAnchor;
  setHoveredAnchor: (anchors: TLDrawDocAnchor) => void;
}) => {
  const selectedAnchorsRef = useRef<TLDrawDocAnchor[]>();
  selectedAnchorsRef.current = selectedAnchors;

  const hoveredAnchorRef = useRef<TLDrawDocAnchor>();
  hoveredAnchorRef.current = hoveredAnchor;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const onChange = () => {
      if (editor.hoveredShapeId !== hoveredAnchorRef.current) {
        setHoveredAnchor(editor.hoveredShapeId);
      }

      if (
        !areAnchorSelectionsEqual(
          "tldraw",
          editor?.selectedShapeIds,
          selectedAnchorsRef.current
        )
      ) {
        setSelectedAnchors(editor.selectedShapeIds);
      }
    };

    editor.on("change", onChange);

    return () => {
      editor.off("change", onChange);
    };
  }, [editor]);
};
