import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { setAnnotationsEffect, annotationsField } from "./annotations";
import { Discussion } from "@/patchwork/schema";

export interface DiscussionTargetPosition {
  x: number;
  y: number;

  discussion: Discussion;
}

interface DiscussionTargetPositionListenerConfig {
  onUpdate: (discussionTargetPositions: DiscussionTargetPosition[]) => void;
  estimatedLineHeight: number;
}

export const discussionTargetPositionListener = ({
  onUpdate,
  estimatedLineHeight,
}: DiscussionTargetPositionListenerConfig) => {
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
            tr.effects.some((e) => e.is(setAnnotationsEffect))
          )
        ) {
          this.updatePositions(update.view);
        }
      }

      updatePositions(view: EditorView) {
        const annotations = view.state.field(annotationsField);

        // todo: there is probably a better way to do this
        // the problem here is that during update we can't read the positions
        requestAnimationFrame(() => {
          const discussionTargetPostions = annotations.flatMap((annotation) => {
            if ("type" in annotation && annotation.type === "discussion") {
              const lastLineBreakIndex = view.state
                .sliceDoc(annotation.from, annotation.to)
                .trimEnd() // trim to ignore line breaks at the end of the string
                .lastIndexOf("\n");
              const fromIndex =
                lastLineBreakIndex === -1
                  ? annotation.from
                  : annotation.from + lastLineBreakIndex + 1;

              const fromCoords = view.coordsAtPos(fromIndex);
              const discussion = (annotation as any).discussion; // todo: fix types

              if (!discussion) {
                return [];
              }

              if (fromCoords) {
                return [
                  {
                    discussion,
                    x: fromCoords.left,
                    y: fromCoords.bottom,
                  },
                ];
              }

              // fallback: estimate position based on line number
              const lineNumber = view.state.doc.lineAt(fromIndex).number;

              return [
                {
                  discussion,
                  x: 0,
                  y: lineNumber * estimatedLineHeight,
                },
              ];
            }
            return [];
          });

          onUpdate(discussionTargetPostions);
        });
      }
    }
  );
};
