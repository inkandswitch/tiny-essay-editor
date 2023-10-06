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
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
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
const activeThreadDecoration = Decoration.mark({
  class: "cm-comment-thread active",
});

const threadDecorations = EditorView.decorations.compute(
  [threadsField],
  (state) => {
    const commentThreads = state.field(threadsField);

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
    padding: "10px 60px",
    textAlign: "justify",
    lineHeight: "24px",
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
  ".cm-comment-thread.active": {
    backgroundColor: "rgb(255 227 135)",
  },
});

export function MarkdownEditor({
  handle,
  path,
  setSelection,
  setView,
  activeThreadId,
  setActiveThreadId,
}: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);

  const getThreadsForDecorations = useCallback(
    () =>
      getCommentThreadsWithPositions(
        handle.docSync(),
        editorRoot.current,
        activeThreadId
      ).filter((thread) => !thread.resolved),
    [activeThreadId, handle]
  );

  // Propagate activeThreadId into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setThreadsEffect.of(getThreadsForDecorations()),
    });
  }, [activeThreadId, getThreadsForDecorations]);

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
        const newSelection = transaction.newSelection.ranges[0];
        if (transaction.newSelection !== view.state.selection) {
          // set the active thread id if our selection is in a thread
          for (const thread of getThreadsForDecorations()) {
            if (
              thread.from <= newSelection.from &&
              thread.to >= newSelection.to
            ) {
              setActiveThreadId(thread.id);
              break;
            }
            setActiveThreadId(null);
          }
        }
        view.update([transaction]);
        semaphore.reconcile(handle, view);
        const selection = view.state.selection.ranges[0];
        setSelection({
          from: selection.from,
          to: selection.to,
          yCoord: view.coordsAtPos(selection.from).top,
        });

        // See if this transaction changed the selection
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
        onKeyDown={(evt) => {
          // Let cmd-s thru for saving the doc
          if (evt.key === "s" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          evt.stopPropagation();
        }}
      />
    </div>
  );
}
