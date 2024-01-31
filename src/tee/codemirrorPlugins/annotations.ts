import { EditorView, Decoration } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { AnnotationPosition } from "../schema";
import { amRangeToCMRange } from "../utils";
import { sortBy } from "lodash";
import { getCursorPosition } from "@automerge/automerge/next";

export const setAnnotationsEffect = StateEffect.define<AnnotationPosition[]>();
export const annotationsField = StateField.define<AnnotationPosition[]>({
  create() {
    return [];
  },
  update(threads, tr) {
    for (const e of tr.effects) {
      if (e.is(setAnnotationsEffect)) {
        return e.value;
      }
    }
    return threads;
  },
});

const commentThreadDecoration = Decoration.mark({ class: "cm-comment-thread" });
const activeThreadDecoration = Decoration.mark({
  class: "cm-comment-thread active",
});

export const annotationDecorations = EditorView.decorations.compute(
  [annotationsField],
  (state) => {
    const annotations = state.field(annotationsField);

    // TODO: for threads which represent edit groups and point to multiple ranges of text,
    // we can highight all of those multiple ranges here.
    const decorations =
      sortBy(annotations ?? [], (annotation) => annotation.from)?.flatMap(
        (annotation) => {
          const cmRange = amRangeToCMRange(annotation);
          if (annotation.to > annotation.from) {
            if (annotation.active) {
              return activeThreadDecoration.range(cmRange.from, cmRange.to);
            } else {
              return commentThreadDecoration.range(cmRange.from, cmRange.to);
            }
          } else {
            return [];
          }
        }
      ) ?? [];

    return Decoration.set(decorations);
  }
);
