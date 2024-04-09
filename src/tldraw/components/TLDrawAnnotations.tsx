import { Annotation } from "@/patchwork/schema";
import { Editor, TLShape, TLShapeId, Tldraw } from "@tldraw/tldraw";
import { useEffect, useState } from "react";
import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "automerge-tldraw";
import { DocHandle } from "@automerge/automerge-repo";
import { useDiffStyling } from "./hooks";

export const TLDrawAnnotations = ({
  handle,
  doc,
  annotations,
}: {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  annotations: Annotation<TLShapeId, TLShape>[];
}) => {
  const store = useAutomergeStore({ handle, doc, userId: "" });
  const [editor, setEditor] = useState<Editor>();

  const annotationsWithState = annotations.map((a) => ({
    ...a,
    isFocused: false,
  }));

  useDiffStyling({ doc, annotations: annotationsWithState, store, editor });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const shapeIds = annotations.map((a) => a.target);
    editor.panZoomIntoView(shapeIds, { duration: 50 });
  }, [editor, annotations]);

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
