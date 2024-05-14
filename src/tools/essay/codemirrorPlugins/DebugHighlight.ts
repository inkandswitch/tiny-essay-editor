import { Decoration, EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

export interface DebugHighlight {
  from: number;
  to: number;
  class: string;
}
export const setDebugHighlightsEffect = StateEffect.define<DebugHighlight[]>();
export const debugHighlightsField = StateField.define<DebugHighlight[]>({
  create() {
    return [];
  },
  update(hightlights, tr) {
    for (const e of tr.effects) {
      if (e.is(setDebugHighlightsEffect)) {
        return e.value.sort((a, b) => a.from - b.from);
      }
    }

    return hightlights;
  },
});
export const debugHighlightsDecorations = EditorView.decorations.compute(
  [debugHighlightsField],
  (state) => {
    const highlights = state.field(debugHighlightsField);

    return Decoration.set(
      highlights.map((highlight) => {
        return Decoration.mark({ class: highlight.class }).range(
          highlight.from,
          highlight.to + (highlight.to === highlight.from ? 1 : 0)
        );
      })
    );
  }
);
