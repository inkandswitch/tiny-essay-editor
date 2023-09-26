import { next as Automerge } from "@automerge/automerge";
import { Editor, Operation, Range, SelectionOperation, Point } from "slate";
import range from "lodash/range";
import every from "lodash/every";
import { createDraft, finishDraft, isDraft } from "immer";

export type AutomergeSpan = {
  // todo: add type exports for this to the automerge cursors branch
  start: Automerge.Cursor;
  end: Automerge.Cursor;
};

export type TextFormat = "bold" | "italic" | "underline";

export type MarkdownDoc = {
  content: string;
};

export type RichTextDoc = {
  content: string;
  formatSpans: { span: AutomergeSpan; format: TextFormat; remove?: boolean }[];
};

type ToggleInlineFormatOperation = {
  type: "toggle_inline_formatting";
  selection: Range;
  format: TextFormat;
};

// Our own Operation type, which includes all of Slate's operations
// and some custom operations of our own.
// (Todo: probably eventually makes sense to fully customize our operation types)
export type ExtendedSlateOperation = Operation | ToggleInlineFormatOperation;

/**
 * Applies an operation from the Slate editor to the Automerge doc storing the content.
 * (Because of how Automerge handles reads/writes separately,
 * we pass in a readable copy and a function to facilitate writes)
 * @param op - the operation to apply
 * @param doc - a readable version of the Automerge document
 * @param changeDoc - to write to the doc, pass a callback into changeDoc
 */
export function applySlateOp(
  op: ExtendedSlateOperation,
  doc: RichTextDoc,
  changeDoc: (callback: (doc: RichTextDoc) => void) => void,
  editor: Editor
): void {
  let selection = editor.selection && createDraft(editor.selection);

  switch (op.type) {
    // Parts of this code are copied from general.ts in the original slate library.
    // In general, the pattern is:
    // 1) Make text updates to the Automerge doc
    // 2) Make selection updates directly to the Slate editor

    case "insert_text": {
      changeDoc((d) =>
        Automerge.splice<{ content: string }>(
          d,
          ["content"],
          op.offset,
          0,
          op.text
        )
      );

      // move the cursor over one
      if (selection) {
        for (const [point, key] of Range.points(selection)) {
          selection[key] = Point.transform(point, op)!;
        }
      }

      break;
    }

    case "remove_text": {
      changeDoc((d) =>
        Automerge.splice(d, ["content"], op.offset, op.text.length)
      );

      if (selection) {
        for (const [point, key] of Range.points(selection)) {
          selection[key] = Point.transform(point, op)!;
        }
      }

      break;
    }

    case "toggle_inline_formatting": {
      throw new Error("Not implemented yet");
      const flatFormatting = flattenedFormatting(doc);
      const selectedArray = flatFormatting.slice(
        Range.start(op.selection).offset,
        Range.end(op.selection).offset
      );
      const isActive = every(selectedArray, (c) => c && c[op.format] === true);
      const span = automergeSpanFromSlateRange(doc.content, op.selection);
      if (isActive) {
        changeDoc((d) =>
          d.formatSpans.push({ span, format: op.format, remove: true })
        );
        // Note: In normal Slate usage you'd put something like this:
        // Editor.removeMark(editor, format)
        // which would split up tree nodes and set properties on the newly created node.
        // Instead of doing this, we record the format span in the annotations representation,
        // and we avoid splitting nodes.
      } else {
        changeDoc((d) => d.formatSpans.push({ span, format: op.format }));
        // Same as above; don't do Slate's typical process here
        // Editor.addMark(editor, format, true)
      }

      break;
    }

    case "set_selection": {
      const { newProperties } = op;

      if (newProperties == null) {
        selection = newProperties;
      } else {
        if (selection == null) {
          if (!Range.isRange(newProperties)) {
            throw new Error(
              `Cannot apply an incomplete "set_selection" operation properties ${JSON.stringify(
                newProperties
              )} when there is no current selection.`
            );
          }

          selection = { ...newProperties };
        }

        for (const key in newProperties) {
          const value = newProperties[key];

          if (value == null) {
            if (key === "anchor" || key === "focus") {
              throw new Error(`Cannot remove the "${key}" selection property`);
            }

            delete selection[key];
          } else {
            selection[key] = value;
          }
        }
      }

      break;
    }
  }

  editor.selection = isDraft(selection)
    ? (finishDraft(selection) as Range)
    : selection;
}

// convert an Automerge Span to a Slate Range.
// Assumes the Slate doc only has a single text node, and no other blocks.
export function slateRangeFromAutomergeSpan(span: AutomergeSpan): Range {
  return {
    anchor: {
      path: [0, 0],
      offset: span.start.index,
    },
    focus: {
      path: [0, 0],
      offset: span.end.index,
    },
  };
}

// convert a Slate Range to an Automerge Span.
// Assumes the Slate doc only has a single text node, and no other blocks.
export function automergeSpanFromSlateRange(
  text: string,
  range: Range
): AutomergeSpan {
  return {
    start: text.getCursorAt(range.anchor.offset),
    end: text.getCursorAt(range.focus.offset),
  };
}

// Returns an array of objects, one per character in the doc,
// representing the formatting applied to that character.
// Useful for figuring out how a toggle operation should behave

// todo: make this faster? could subset the list of spans
// todo: think about merging overlapping spans?
function flattenedFormatting(doc: RichTextDoc) {
  const chars: { [key: string]: boolean }[] = range(doc.content.length).map(
    (c) => {}
  );
  for (const formatSpan of doc.formatSpans) {
    let start: number, end: number;

    // compute a start and end s.t. start comes before end
    // so we don't end up with backwards spans
    if (formatSpan.span.end.index > formatSpan.span.start.index) {
      start = formatSpan.span.start.index;
      end = formatSpan.span.end.index;
    } else {
      start = formatSpan.span.end.index;
      end = formatSpan.span.start.index;
    }

    for (let i = start; i < end; i++) {
      if (chars[i] === undefined) chars[i] = {};
      if (!formatSpan.remove) {
        chars[i][formatSpan.format] = true;
      } else {
        chars[i][formatSpan.format] = false;
      }
    }
  }

  return chars;
}
