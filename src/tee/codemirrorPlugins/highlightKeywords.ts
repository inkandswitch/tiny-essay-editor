import {
  ViewPlugin,
  DecorationSet,
  EditorView,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

export const highlightKeywordsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getHighlightWords(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getHighlightWords(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// TODO: make these highlight words configurable in the app
const HIGHLIGHT_KEYWORDS_REGEX = /TODO|@Paul|@Geoffrey|@Alex/g;
function getHighlightWords(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    while ((match = HIGHLIGHT_KEYWORDS_REGEX.exec(text))) {
      const position = match.index + from;
      decorations.push(
        Decoration.mark({
          class: "bg-red-200 p-1 rounded-sm",
        }).range(position, position + match[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}
