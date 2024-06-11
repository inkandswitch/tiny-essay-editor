// Indent a long wrapped line
// Adapted from this source (w/ modifications): https://gist.github.com/dralletje/058fe51415fe7dbac4709a65c615b52e

/**
 * Plugin that makes line wrapping in the editor respect the identation of the line.
 * It does this by adding a line decoration that adds padding-left (as much as there is indentation),
 * and adds the same amount as negative "text-indent". The nice thing about text-indent is that it
 * applies to the initial line of a wrapped line.
 */

import _ from "lodash";
import { StateField } from "@codemirror/state";
import { EditorView, Decoration } from "@codemirror/view";

// This is just approx the width of a space in our default font.
// In the future if we allow other fonts/sizes we'll need a better approach.
const SPACE_WIDTH = 4;

const ARBITRARY_INDENT_LINE_WRAP_LIMIT = 48;
const line_wrapping_decorations = StateField.define({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    const tabSize = tr.state.tabSize;
    const charWidth = SPACE_WIDTH;

    if (!tr.docChanged && deco !== Decoration.none) return deco;

    const decorations = [];

    for (const i of _.range(0, tr.state.doc.lines)) {
      const line = tr.state.doc.line(i + 1);
      if (line.length === 0) continue;

      let indented_chars = 0;
      for (const ch of line.text) {
        if (ch === "\t") {
          indented_chars = indented_chars + tabSize;
        } else if (ch === " ") {
          indented_chars = indented_chars + 1;
        } else {
          break;
        }
      }

      const offset =
        Math.min(indented_chars, ARBITRARY_INDENT_LINE_WRAP_LIMIT) * charWidth;

      // TODO? Cache the CSSStyleDeclaration?
      const rules = document.createElement("span").style;
      rules.setProperty("--idented", `${offset}px`);
      rules.setProperty("text-indent", "calc(-1 * var(--idented) - 1px)"); // I have no idea why, but without the - 1px it behaves weirdly periodically
      rules.setProperty(
        "padding-left",
        "calc(var(--idented) + var(--cm-left-padding, 4px))"
      );

      const linerwapper = Decoration.line({
        attributes: { style: rules.cssText },
      });

      decorations.push(linerwapper.range(line.from, line.from));
    }
    return Decoration.set(decorations, true);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const lineWrappingPlugin = [line_wrapping_decorations];
