import {
  ViewPlugin,
  DecorationSet,
  EditorView,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

const CODE_BLOCK_REGEX = /```.*?```/gs;
function getCodeDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  const text = view.state.doc.sliceString(0);

  const codeBlockMatches = text.matchAll(CODE_BLOCK_REGEX);

  for (const match of codeBlockMatches) {
    const position = match.index;

    decorations.push(
      Decoration.mark({
        class: "font-mono text-sm text-left inline-block",
      }).range(position, position + match[0].length)
    );
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

export const codeMonospacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getCodeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getCodeDecorations(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
