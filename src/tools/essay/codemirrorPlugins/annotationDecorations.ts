import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

import { AnnotationWithUIState } from "@/patchwork/schema";
import { ResolvedMarkdownDocAnchor } from "../../../datatypes/markdown/schema";

export const setAnnotationsEffect =
  StateEffect.define<
    AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[]
  >();
export const annotationsField = StateField.define<
  AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[]
>({
  create() {
    return [];
  },
  update(patches, tr) {
    for (const e of tr.effects) {
      if (e.is(setAnnotationsEffect)) {
        return e.value;
      }
    }
    return patches;
  },
});
class DeletionMarker extends WidgetType {
  deletedText: string;
  isActive: boolean;

  constructor(deletedText: string, isActive: boolean) {
    super();
    this.deletedText = deletedText;
    this.isActive = isActive;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("div");
    box.style.display = "inline-block";
    box.style.boxSizing = "border-box";
    box.style.padding = "0 2px";
    box.style.color = "rgb(236 35 35)";
    box.style.margin = "0 4px";
    box.style.fontSize = "0.8em";
    box.style.backgroundColor = this.isActive
      ? "rgb(255 0 0 / 20%)"
      : "rgb(255 0 0 / 10%)";
    box.style.borderRadius = "3px";
    box.style.cursor = "default";
    box.innerText = "⌫";

    const hoverText = document.createElement("div");
    hoverText.style.position = "absolute";
    hoverText.style.zIndex = "1";
    hoverText.style.padding = "10px";
    hoverText.style.backgroundColor = "rgb(255 230 230)";
    hoverText.style.fontSize = "15px";
    hoverText.style.color = "black";
    hoverText.style.padding = "5px";
    hoverText.style.border = "rgb(100 55 55)";
    hoverText.style.boxShadow = "0px 0px 6px rgba(0, 0, 0, 0.1)";
    hoverText.style.borderRadius = "3px";
    hoverText.style.visibility = "hidden";
    hoverText.innerText = this.deletedText;

    box.appendChild(hoverText);

    box.onmouseover = function () {
      hoverText.style.visibility = "visible";
    };
    box.onmouseout = function () {
      hoverText.style.visibility = "hidden";
    };

    return box;
  }

  eq(other) {
    return (
      other.deletedText === this.deletedText && other.isActive === this.isActive
    );
  }

  ignoreEvent() {
    return true;
  }
}

const spliceDecoration = Decoration.mark({ class: "cm-patch-splice" });
const spliceDecorationActive = Decoration.mark({
  class: "cm-patch-splice active",
});

const highlightDecoration = Decoration.mark({ class: "cm-comment-thread" });
const highlightDecorationActive = Decoration.mark({
  class: "cm-comment-thread active",
});

const makeDeleteDecoration = (deletedText: string, isActive: boolean) =>
  Decoration.widget({
    widget: new DeletionMarker(deletedText, isActive),
    side: 1,
  });

export const annotationDecorations = EditorView.decorations.compute(
  [annotationsField],
  (state) => {
    const annotations = state.field(annotationsField);

    const decorations = annotations.flatMap((annotation) => {
      const { fromPos, toPos } = annotation.anchor;
      if (fromPos >= toPos) {
        return [];
      }

      switch (annotation.type) {
        case "added": {
          const decoration = annotation.isEmphasized
            ? spliceDecorationActive
            : spliceDecoration;
          return [decoration.range(fromPos, toPos)];
        }
        case "deleted": {
          return [
            makeDeleteDecoration(
              annotation.deleted,
              annotation.isEmphasized
            ).range(fromPos),
          ];
        }

        case "changed": {
          const decoration = annotation.isEmphasized
            ? spliceDecorationActive
            : spliceDecoration;
          return [
            decoration.range(fromPos, toPos),
            makeDeleteDecoration(
              annotation.before,
              annotation.isEmphasized
            ).range(toPos),
          ];
        }

        case "highlighted": {
          const decoration = annotation.isEmphasized
            ? highlightDecorationActive
            : highlightDecoration;
          return [decoration.range(fromPos, toPos)];
        }
      }
      return [];
    });

    return Decoration.set(decorations, true);
  }
);
