import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { setAnnotationsEffect, annotationsField } from "./annotations";
import { patchesField, setPatchesEffect } from "./patchDecorations";

import { Annotation } from "@/patchwork/schema";
import { MarkdownDocAnchor } from "../schema";

interface AnnotationTargetPositionListenerConfig {
  onUpdate: (
    discussionTargetPositions: AnnotationTargetPosition<
      MarkdownDocAnchor,
      string
    >[]
  ) => void;
  estimatedLineHeight: number;
}

export const annotationTargetPositionListener = ({
  onUpdate,
  estimatedLineHeight,
}: AnnotationTargetPositionListenerConfig) => {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.updatePositions(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setPatchesEffect))
          )
        ) {
          this.updatePositions(update.view);
        }
      }

      updatePositions(view: EditorView) {
        const annotations = view.state.field(patchesField);

        // todo: there is probably a better way to do this
        // the problem here is that during update we can't read the positions
        requestAnimationFrame(() => {
          const annotationsTargetPostions = annotations.map((annotation) => {
            const { fromPos, toPos, fromCursor, toCursor } = annotation.target;

            const lastLineBreakIndex = view.state
              .sliceDoc(fromPos, toPos)
              .trimEnd() // trim to ignore line breaks at the end of the string
              .lastIndexOf("\n");
            const fromIndex =
              lastLineBreakIndex === -1
                ? fromPos
                : fromPos + lastLineBreakIndex + 1;

            const fromCoords = view.coordsAtPos(fromIndex);

            if (fromCoords) {
              return {
                annotation: {
                  ...annotation,
                  target: { fromCursor, toCursor },
                },
                x: fromCoords.left,
                y: fromCoords.bottom,
              };
            }

            // fallback: estimate position based on line number
            const lineNumber = view.state.doc.lineAt(fromIndex).number;

            return {
              annotation: {
                ...annotation,
                target: { fromCursor, toCursor },
              },
              x: 0,
              y: lineNumber * estimatedLineHeight,
            };
          });

          console.log("report", annotationsTargetPostions);

          onUpdate(annotationsTargetPostions);
        });
      }
    }
  );
};
