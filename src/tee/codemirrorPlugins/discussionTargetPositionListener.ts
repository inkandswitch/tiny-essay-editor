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
                const firstLineBreakIndex = view.state
                  .sliceDoc(annotation.from, annotation.to)
                  .indexOf("\n");
                const fromIndex = annotation.from;
                const toIndex =
                  firstLineBreakIndex === -1
                    ? annotation.to
                    : firstLineBreakIndex + annotation.from;

                const fromCoords = view.coordsAtPos(fromIndex);
                const toCoords = view.coordsAtPos(toIndex);
                if (!fromCoords || !toCoords) {
                  return [];
                }
                return [
                  {
                    discussion: (annotation as any).discussion, // todo: fix types
                    x:
                      (fromCoords.left + toCoords.right) / 2 -
                      overlayContainer.left,
                    y: toCoords.top - overlayContainer.top * 2,
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
