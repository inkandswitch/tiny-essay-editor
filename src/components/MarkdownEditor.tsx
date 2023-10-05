import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { EditorView, Decoration } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { Prop } from "@automerge/automerge";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { type DocHandle } from "@automerge/automerge-repo";
import { CommentThreadForUI, MarkdownDoc } from "../schema";
import { amRangeToCMRange, getCommentThreadsWithPositions } from "@/utils";
import { sortBy } from "lodash";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export type EditorProps = {
  handle: DocHandle<MarkdownDoc>;
  path: Prop[];
  setSelection: (selection: TextSelection) => void;
  setView: (view: EditorView) => void;
};

const setThreadsEffect = StateEffect.define<CommentThreadForUI[]>();
const threadsField = StateField.define<CommentThreadForUI[]>({
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

const threadDecorations = EditorView.decorations.compute(
  [threadsField],
  (state) => {
    const commentThreads = state.field(threadsField);

    const decorations =
      sortBy(commentThreads ?? [], (thread) => thread.from)?.flatMap(
        (thread) => {
          const cmRange = amRangeToCMRange(thread);
          return thread.to > thread.from
            ? threadDecoration.range(cmRange.from, cmRange.to)
            : [];
        }
      ) ?? [];

    return Decoration.set(decorations);
  }
);

const theme = EditorView.theme({
  "&": {},
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  "&.cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    height: "100%",
  },
  ".cm-content": {
    height: "100%",
    fontFamily: '"Merriweather", serif',
    padding: "10px",
    textAlign: "justify",
  },
  ".cm-activeLine": {
    backgroundColor: "inherit",
  },
  // todo can we rely on this class name?
  ".ͼ7": {
    fontFamily: '"Merriweather Sans", sans-serif',
    fontSize: "1.3rem",
    textDecoration: "none",
    fontWeight: 300,
  },
  ".cm-comment-thread": {
    backgroundColor: "rgb(255 249 194)",
  },
});

export function MarkdownEditor({
  handle,
  path,
  setSelection,
  setView,
}: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);

  const getThreadsForDecorations = useCallback(
    () =>
      Object.values(
        getCommentThreadsWithPositions(handle.docSync(), editorRoot.current)
      ).filter((thread) => !thread.resolved),
    []
  );

  useEffect(() => {
    const doc = handle.docSync();
    const source = doc.content; // this should use path
    const plugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(plugin);
    const view = new EditorView({
      doc: source,
      extensions: [
        basicSetup,
        plugin,
        EditorView.lineWrapping,
        theme,
        markdown({}),
        threadsField,
        threadDecorations,
      ],
      dispatch(transaction) {
        view.update([transaction]);
        semaphore.reconcile(handle, view);
        const selection = view.state.selection.ranges[0];
        setSelection({
          from: selection.from,
          to: selection.to,
          yCoord: view.coordsAtPos(selection.from).top,
        });
      },
      parent: containerRef.current,
    });

    editorRoot.current = view;

    // pass the view up to the parent so it can use it too
    setView(view);

    view.dispatch({
      effects: setThreadsEffect.of(getThreadsForDecorations()),
    });

    handle.addListener("change", () => {
      semaphore.reconcile(handle, view);

      // TODO: is this the right place to update the threads field? not sure.
      view.dispatch({
        effects: setThreadsEffect.of(getThreadsForDecorations()),
      });
    });

    return () => {
      handle.removeAllListeners();
      view.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col items-stretch min-h-screen">
      <div
        className="codemirror-editor flex-grow relative min-h-screen"
        ref={containerRef}
        onKeyDown={(evt) => evt.stopPropagation()}
      />
    </div>
  );
}
