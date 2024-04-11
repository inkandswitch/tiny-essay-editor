import { AnnotationWithUIState } from "@/patchwork/schema";
import { Editor, TLShape, TLShapeId, Tldraw } from "@tldraw/tldraw";
import { useEffect, useMemo, useState } from "react";
import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { DocHandle } from "@automerge/automerge-repo";
import { useDiffStyling } from "./hooks";

export const TLDrawAnnotations = ({
  handle,
  doc,
  annotations,
}: {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  annotations: AnnotationWithUIState<TLShapeId, TLShape>[];
}) => {
  const store = useAutomergeStore({ handle, doc, userId: "test-user" });
  const [editor, setEditor] = useState<Editor>();

  const annotationsWithState = useMemo(
    () =>
      annotations.map((a) => ({
        ...a,
        isEmphasized: false,
      })),
    [annotations]
  );

  useDiffStyling({ doc, annotations: annotationsWithState, store, editor });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const shapeIds = annotations.flatMap((a) => a.target);
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
