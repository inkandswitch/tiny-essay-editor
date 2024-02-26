import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { setAnnotationsEffect, annotationsField } from "./annotations";
import { Discussion } from "@/patchwork/schema";

export interface DiscussionTargetPosition {
  x: number;
  y: number;
  discussion: Discussion;
}

export interface OverlayContainer {
  width: number;
  height: number;
  top: number;
  left: number;
  scrollOffset: number;
}

export const setOverlayContainerEffect = StateEffect.define<OverlayContainer>();
export const overlayContainerField = StateField.define<OverlayContainer | null>(
  {
    create() {
      return null;
    },
    update(rect, tr) {
      for (const e of tr.effects) {
        if (e.is(setOverlayContainerEffect)) {
          return e.value;
        }
      }

      return rect;
    },
  }
);

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
            tr.effects.some(
              (e) =>
                e.is(setAnnotationsEffect) || e.is(setOverlayContainerEffect)
            )
          )
        ) {
          this.updatePositions(update.view);
        }
      }

      updatePositions(view: EditorView) {
        const overlayContainer = view.state.field(overlayContainerField);
        const annotations = view.state.field(annotationsField);

        if (!overlayContainer) {
          return;
        }

        // todo: there is probably a better way to do this
        // the problem here is that during update we can't read the positions
        requestAnimationFrame(() => {
          onUpdate(
            annotations.flatMap((annotation) => {
              if ("type" in annotation && annotation.type === "discussion") {
                const pos = view.coordsAtPos(annotation.to);
                if (!pos) {
                  return [];
                }
                return [
                  {
                    discussion: (annotation as any).discussion, // todo: fix types
                    x: pos.right - overlayContainer.left,
                    y: (pos.top + pos.bottom) / 2 - overlayContainer.top * 2,
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
