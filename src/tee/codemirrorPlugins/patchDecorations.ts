import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import * as A from "@automerge/automerge/next";
import { StateEffect, StateField } from "@codemirror/state";

import { annotationsField } from "./annotations";
import { Annotation } from "@/patchwork/schema";
import { MarkdownDocAnchor, ResolvedMarkdownDocAnchor } from "../schema";

// Stuff for patches decoration
// TODO: move this into a separate file
export const setPatchesEffect =
  StateEffect.define<Annotation<ResolvedMarkdownDocAnchor, string>[]>();
export const patchesField = StateField.define<
  Annotation<ResolvedMarkdownDocAnchor, string>[]
>({
  create() {
    return [];
  },
  update(patches, tr) {
    for (const e of tr.effects) {
      if (e.is(setPatchesEffect)) {
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
export const patchDecorations = EditorView.decorations.compute(
  [patchesField, annotationsField],
  (state) => {
    const activeAnnotations = state
      .field(annotationsField)
      .filter((annotationsField) => annotationsField.active);

    const annotations = state.field(patchesField);

    const decorations = annotations.flatMap((annotation) => {
      const { fromPos, toPos } = annotation.target;
      if (fromPos >= toPos) {
        return [];
      }
      const isActive = activeAnnotations.some(
        (activeAnnotation) =>
          fromPos >= activeAnnotation.from && toPos <= activeAnnotation.to
      );

      switch (annotation.type) {
        case "added": {
          const decoration = isActive
            ? spliceDecorationActive
            : spliceDecoration;
          return [decoration.range(fromPos, toPos)];
        }
        case "deleted": {
          return [
            makeDeleteDecoration(annotation.deleted, isActive).range(fromPos),
          ];
        }

        case "highlighted": {
          const decoration = isActive
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
