import {
  ViewPlugin,
  DecorationSet,
  EditorView,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

export const frontmatterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getFrontmatterDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getFrontmatterDecorations(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const frontmatterRegex = /^---.*---/s;
function getFrontmatterDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    const frontmatterMatch = text.match(frontmatterRegex);

    if (frontmatterMatch) {
      const position = frontmatterMatch.index + from;
      decorations.push(
        Decoration.mark({
          class: "frontmatter",
        }).range(position, position + frontmatterMatch[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}
