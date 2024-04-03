import { EditorView, Decoration } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { CommentThreadForUI } from "../schema";
import { amRangeToCMRange } from "../utils";
import { sortBy } from "lodash";
import { ResolvedMarkdownDocAnchor } from "../schema";

export type DocAnchorHiglight = ResolvedMarkdownDocAnchor & {
  isActive: boolean;
};

export const setDocAnchorHighlightsEffect =
  StateEffect.define<DocAnchorHiglight[]>();
export const docAnchorHighlightsField = StateField.define<DocAnchorHiglight[]>({
  create() {
    return [];
  },
  update(highlights, tr) {
    for (const e of tr.effects) {
      if (e.is(setDocAnchorHighlightsEffect)) {
        return e.value;
      }
    }
    return highlights;
  },
});

const docAnchorHighlightDecoration = Decoration.mark({
  class: "cm-comment-thread",
});
const activeDocAnchorHighlightDecoration = Decoration.mark({
  class: "cm-comment-thread active",
});

export const docAnchorDecorations = EditorView.decorations.compute(
  [docAnchorHighlightsField],
  (state) => {
    const docAnchors = state.field(docAnchorHighlightsField);

    const decorations =
      sortBy(docAnchors ?? [], (docAnchor) => docAnchor.fromPos)?.flatMap(
        (docAnchor) => {
          const cmRange = amRangeToCMRange({
            from: docAnchor.fromPos,
            to: docAnchor.toPos,
          });

          if (docAnchor.toPos > docAnchor.fromPos) {
            if (docAnchor.isActive) {
              return activeDocAnchorHighlightDecoration.range(
                cmRange.from,
                cmRange.to
              );
            } else {
              return docAnchorHighlightDecoration.range(
                cmRange.from,
                cmRange.to
              );
            }
          } else {
            return [];
          }
        }
      ) ?? [];

    return Decoration.set(decorations);
  }
);
