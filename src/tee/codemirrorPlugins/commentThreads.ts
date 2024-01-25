import { EditorView, Decoration } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { TextAnnotationForUI } from "../schema";
import { amRangeToCMRange } from "../utils";
import { sortBy } from "lodash";

export const setThreadsEffect = StateEffect.define<TextAnnotationForUI[]>();
export const threadsField = StateField.define<TextAnnotationForUI[]>({
  create() {
    return [];
  },
  update(threads, tr) {
    for (const e of tr.effects) {
      if (e.is(setThreadsEffect)) {
        return e.value;
      }
    }
    return threads;
  },
});

const threadDecoration = Decoration.mark({ class: "cm-comment-thread" });
const activeThreadDecoration = Decoration.mark({
  class: "cm-comment-thread active",
});

export const threadDecorations = EditorView.decorations.compute(
  [threadsField],
  (state) => {
    const commentThreads = state.field(threadsField);

    // TODO: for threads which represent edit groups and point to multiple ranges of text,
    // we can highight all of those multiple ranges here.
    const decorations =
      sortBy(commentThreads ?? [], (thread) => thread.from)?.flatMap(
        (thread) => {
          const cmRange = amRangeToCMRange(thread);
          if (thread.to > thread.from) {
            if (thread.active) {
              return activeThreadDecoration.range(cmRange.from, cmRange.to);
            } else {
              return threadDecoration.range(cmRange.from, cmRange.to);
            }
          } else {
            return [];
          }
        }
      ) ?? [];

    return Decoration.set(decorations);
  }
);
