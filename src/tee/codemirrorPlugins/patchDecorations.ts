import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import * as A from "@automerge/automerge/next";
import { StateEffect, StateField } from "@codemirror/state";
import { DiffStyle } from "../components/MarkdownEditor";

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

  constructor(deletedText: string) {
    super();
    this.deletedText = deletedText;
  }

  toDOM(): HTMLElement {
    const box = document.createElement("div");
    box.style.display = "inline-block";
    box.style.boxSizing = "border-box";
    box.style.padding = "0 2px";
    box.style.color = "rgb(236 35 35)";
    box.style.margin = "0 4px";
    box.style.fontSize = "0.8em";
    box.style.backgroundColor = "rgb(255 0 0 / 10%)";
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

  eq() {
    // todo: i think this is right for now until we show hover of del text etc
    return true;
  }

  ignoreEvent() {
    return true;
  }
}
const privateDecoration = Decoration.mark({ class: "cm-patch-private" });
const spliceDecoration = Decoration.mark({ class: "cm-patch-splice" });
const makeDeleteDecoration = (deletedText: string) =>
  Decoration.widget({
    widget: new DeletionMarker(deletedText),
    side: 1,
  });
export const patchDecorations = (diffStyle: DiffStyle) =>
  EditorView.decorations.compute([patchesField], (state) => {
    const patches = state
      .field(patchesField)
      .filter((patch) => patch.path[0] === "content");

    const decorations = patches.flatMap((patch) => {
      switch (patch.action) {
        case "splice": {
          const from = patch.path[1] as number;
          const length = patch.value.length;
          const decoration =
            diffStyle === "private" ? privateDecoration : spliceDecoration;
          return [decoration.range(from, from + length)];
        }
        case "del": {
          if (patch.path.length < 2) {
            console.error("this is so weird! why??");
            return [];
          }
          const from = patch.path[1] as number;
          return [makeDeleteDecoration(patch.removed).range(from)];
        }
      }
      return [];
    });

    return Decoration.set(decorations);
  });
