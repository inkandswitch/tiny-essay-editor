import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { setAnnotationsEffect, annotationsField } from "./annotations";
import { Discussion } from "@/patchwork/schema";

export interface DiscussionTargetPosition {
  x: number;
  y: number;
  discussion: Discussion;
}

export const discussionTargetPositionListener = (
  onUpdate: (discussionTargetPositions: DiscussionTargetPosition[]) => void
) => {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.updatePositions(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
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
          onUpdate(
            annotations.flatMap((annotation) => {
              console.log(annotation);

              if ("type" in annotation && annotation.type === "discussion") {
                const pos = view.coordsAtPos(annotation.to);
                if (!pos) {
                  return [];
                }
                return [
                  {
                    discussion: (annotation as any).discussion, // todo: fix types
                    x: pos.right,
                    y: (pos.top + pos.bottom) / 2,
                  },
                ];
              }
              return [];
            })
          );
        });
      }
    }
  );
};
