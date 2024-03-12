import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { patchesField, setPatchesEffect } from "./patchDecorations";
import { AnnotationPosition } from "@/patchwork/schema";
import { MarkdownDocAnchor } from "../schema";

interface AnnotationPositionListenerConfig {
  onUpdate: (
    discussionTargetPositions: AnnotationPosition<MarkdownDocAnchor, string>[]
  ) => void;
  editorContainer: HTMLDivElement;
  estimatedLineHeight: number;
}

export const annotationsPositionListener = ({
  onUpdate,
  editorContainer,
  estimatedLineHeight,
}: AnnotationPositionListenerConfig) => {
  console.log(editorContainer);

  return ViewPlugin.fromClass(
    class {
      private resizeObserver = new ResizeObserver(() => {
        this.updatePositions();
      });

      private view: EditorView;
      private annotationPositions: AnnotationPosition<
        MarkdownDocAnchor,
        string
      >[];

      constructor(view: EditorView) {
        this.view = view;
        this.updatePositions();
        this.onScroll = this.onScroll.bind(this);

        this.resizeObserver.observe(editorContainer);
        editorContainer.addEventListener("scroll", this.onScroll);
      }

      destroy() {
        editorContainer.removeEventListener("scroll", this.onScroll);
        this.resizeObserver.disconnect();
      }

      private onScroll() {
        const scrollOffset = editorContainer.scrollTop;
        onUpdate(
          this.annotationPositions.map((position) => ({
            ...position,
            y: position.y - scrollOffset,
          }))
        );
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setPatchesEffect))
          )
        ) {
          this.updatePositions();
        }
      }

      updatePositions() {
        const annotations = this.view.state.field(patchesField);

        // todo: there is probably a better way to do this
        // the problem here is that during update we can't read the positions
        requestAnimationFrame(() => {
          const annotationPositions = annotations.map((annotation) => {
            const { fromPos, toPos, fromCursor, toCursor } = annotation.target;

            const lastLineBreakIndex = this.view.state
              .sliceDoc(fromPos, toPos)
              .trimEnd() // trim to ignore line breaks at the end of the string
              .lastIndexOf("\n");
            const fromIndex =
              lastLineBreakIndex === -1
                ? fromPos
                : fromPos + lastLineBreakIndex + 1;

            const fromCoords = this.view.coordsAtPos(fromIndex);

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
            // todo: make this work with line wrap
            const lineNumber = this.view.state.doc.lineAt(fromIndex).number;

            return {
              annotation: {
                ...annotation,
                target: { fromCursor, toCursor },
              },
              x: 0,
              y: lineNumber * estimatedLineHeight,
            };
          });

          onUpdate(annotationPositions);

          const scrollOffset = editorContainer?.scrollTop ?? 0;
          this.annotationPositions = annotationPositions.map((position) => ({
            ...position,
            y: position.y + scrollOffset,
          }));
        });
      }
    }
  );
};
