import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import * as A from "@automerge/automerge/next";
import { StateEffect, StateField } from "@codemirror/state";
import { DiffStyle } from "../components/MarkdownEditor";
import { annotationsField } from "./annotations";

// Stuff for patches decoration
// TODO: move this into a separate file
export const setPatchesEffect = StateEffect.define<A.Patch[]>();
export const patchesField = StateField.define<A.Patch[]>({
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

const privateDecoration = Decoration.mark({ class: "cm-patch-private" });
const privateDecorationActive = Decoration.mark({
  class: "cm-patch-private active",
});
const spliceDecoration = Decoration.mark({ class: "cm-patch-splice" });
const spliceDecorationActive = Decoration.mark({
  class: "cm-patch-splice active",
});
const makeDeleteDecoration = (deletedText: string, isActive: boolean) =>
  Decoration.widget({
    widget: new DeletionMarker(deletedText, isActive),
    side: 1,
  });
export const patchDecorations = (diffStyle: DiffStyle) =>
  EditorView.decorations.compute([patchesField, annotationsField], (state) => {
    const activeAnnotations = state
      .field(annotationsField)
      .filter((annotationsField) => annotationsField?.active);

    const patches = state
      .field(patchesField)
      .filter(
        (patch) =>
          patch.path[0] === "content" &&
          ["splice", "del"].includes(patch.action)
      );

    const decorations = patches.flatMap((patch) => {
      switch (patch.action) {
        case "splice": {
          const from = patch.path[1] as number;
          const length = patch.value.length;
          const isActive = activeAnnotations.some(
            (annotation) =>
              from >= annotation.from && from + length <= annotation.to
          );

          const decoration =
            diffStyle === "private"
              ? isActive
                ? privateDecorationActive
                : privateDecoration
              : isActive
              ? spliceDecorationActive
              : spliceDecoration;
          return [decoration.range(from, from + length)];
        }
        case "del": {
          if (patch.path.length < 2) {
            console.error("this is so weird! why??");
            return [];
          }
          const from = patch.path[1] as number;
          const isActive = activeAnnotations.some(
            (annotation) => from >= annotation.from && from <= annotation.to
          );

          return [makeDeleteDecoration(patch.removed, isActive).range(from)];
        }
      }
      return [];
    });

    return Decoration.set(decorations, true);
  });
