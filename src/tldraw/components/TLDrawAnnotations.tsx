import { Annotation } from "@/patchwork/schema";
import { Editor, TLShape, TLShapeId, Tldraw } from "@tldraw/tldraw";
import { useState, useEffect } from "react";

export const TLDrawAnnotations = ({
  annotations,
}: {
  annotations: Annotation<TLShapeId, TLShape>[];
}) => {
  const [editor, setEditor] = useState<Editor>();

  useEffect(() => {
    if (!editor) {
      return;
    }

    const shapes: TLShape[] = [];

    annotations.map((annotation) => {
      switch (annotation.type) {
        case "added":
          shapes.push(annotation.added);
          break;

        case "changed":
          shapes.push(annotation.after);
          break;

        case "deleted":
          shapes.push(annotation.deleted);
          break;

        case "highlighted":
          shapes.push(annotation.value);
          break;
      }
    });

    editor.store.put(shapes);

    editor.zoomToFit();
  }, [editor, annotations]);

  return (
    <div className="h-[200px] w-full relative">
      <Tldraw hideUi={true} onMount={(editor) => setEditor(editor)} />
      <div className="absolute top-0 left-0 bottom-0 right-0 z-[999]"></div>
    </div>
  );
};
