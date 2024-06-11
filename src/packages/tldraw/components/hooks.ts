import { isEqual } from "lodash";
import { useEffect, useRef, useState } from "react";
import { AnnotationWithUIState } from "@/os/versionControl/schema";
import {
  Editor,
  TLCamera,
  TLShape,
  TLShapeId,
  TLStoreWithStatus,
} from "@tldraw/tldraw";
import { TLDrawDoc, TLDrawDocAnchor } from "../datatype";

export const useCameraSync = ({
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
export const useDiffStyling = ({
  doc,
  annotations,
  store,
  editor,
}: {
  doc: TLDrawDoc;
  annotations: AnnotationWithUIState<TLDrawDocAnchor, TLShape>[];
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

    if (!editor) {
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
      const container = editor.getContainer();

      const addedShapeIds = new Set<TLShapeId>();

      annotations.forEach((annotation) => {
        switch (annotation.type) {
          case "highlighted":
          case "added":
            {
              const id =
                annotation.type === "highlighted"
                  ? annotation.value.id
                  : annotation.added.id;

              const shapeElem = container.querySelector(
                `#${id.replace(":", "\\:")}`
              ) as HTMLElement;
              if (!shapeElem) {
                return;
              }

              activeHighlightedElements.add(shapeElem);
              if (!highlightedElementsRef.current.has(shapeElem)) {
                highlightedElementsRef.current.add(shapeElem);
              }

              let highlightColor;
              if (annotation.type === "highlighted") {
                // don't override shapes that have styling from an "added" annotation
                if (!addedShapeIds.has(annotation.anchor)) {
                  if (annotation.isEmphasized) {
                    highlightColor = "rgb(255 228 74)";
                  } else {
                    highlightColor = "rgb(255 246 0)";
                  }
                }
              } else {
                addedShapeIds.add(annotation.anchor);
                highlightColor = "green";
              }

              const dropShadowFilter = `drop-shadow(0 0 ${
                annotation.isEmphasized ? "0.25rem" : "0.75rem"
              } ${highlightColor})`;

              // drop shadow has no spread option, to intesify it when annotation is focused we apply it twice
              shapeElem.style.filter =
                dropShadowFilter +
                (annotation.isEmphasized ? ` ${dropShadowFilter}` : "");
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
  }, [annotations, store, doc, camera, editor]);
};
export const useAnchorEventListener = ({
  editor,
  setSelectedAnchors,
  setHoveredAnchor,
}: {
  editor: Editor;
  setSelectedAnchors: (anchors: TLDrawDocAnchor[]) => void;
  setHoveredAnchor: (anchors: TLDrawDocAnchor) => void;
}) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const onChange = () => {
      setHoveredAnchor(editor.hoveredShapeId);
      setSelectedAnchors(editor.selectedShapeIds);
    };

    editor.on("change", onChange);

    return () => {
      editor.off("change", onChange);
    };
  }, [editor]);
};
