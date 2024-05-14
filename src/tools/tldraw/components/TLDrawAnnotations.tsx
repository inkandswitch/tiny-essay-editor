import { AnnotationsViewProps } from "@/os/tools";
import { Editor, TLShape, TLShapeId, Tldraw } from "@tldraw/tldraw";
import { useEffect, useMemo, useState } from "react";
import { TLDrawDoc } from "../../../datatypes/tldraw/schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { useDiffStyling } from "./hooks";
import { Annotation } from "@/os/versionControl/schema";
import { AnnotationWithUIState } from "@/os/versionControl/schema";
import { DocHandle } from "@automerge/automerge-repo";

export const TLDrawAnnotations = ({
  handle,
  doc,
  annotations,
}: AnnotationsViewProps<TLDrawDoc, TLShapeId, TLShape>) => {
  const store = useAutomergeStore({
    handle,
    doc,
    userId: "test-user",
  });
  const [editor, setEditor] = useState<Editor>();

  const annotationsWithState = useMemo<
    AnnotationWithUIState<TLShapeId, TLShape>[]
  >(
    () =>
      annotations.map((a: Annotation<TLShapeId, TLShape>) => ({
        ...a,
        isEmphasized: false,
        shouldBeVisibleInViewport: false,
      })),
    [annotations]
  );

  useDiffStyling({ doc, annotations: annotationsWithState, store, editor });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const shapeIds = annotations.flatMap((a) => a.anchor);
    editor.panZoomIntoView(shapeIds, { duration: 100 });
  }, [editor, annotations]);

  if (annotations.length === 0) {
    return (
      <div className="text-gray-500 text-xs italic">No shapes selected</div>
    );
  }

  return (
    <div className="h-[200px] w-full relative">
      <Tldraw
        hideUi={true}
        store={store}
        onMount={(editor) => {
          setEditor(editor);
          editor.updateInstanceState({ isReadonly: true });
        }}
      />
      <div className="absolute top-0 left-0 bottom-0 right-0 z-[999]"></div>
    </div>
  );
};
