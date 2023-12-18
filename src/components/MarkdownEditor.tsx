import React, { useEffect, useRef, useState } from "react";

import {
  EditorView,
  keymap,
  highlightSpecialChars,
  drawSelection,
  highlightActiveLine,
  dropCursor,
} from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { StateEffect, StateField, Range, EditorState } from "@codemirror/state";
// import {javascript} from "@codemirror/lang-javascript"
import { YRemoteCaretWidget } from "@/remote-cursors";

import { Prop } from "@automerge/automerge";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { indentWithTab } from "@codemirror/commands";
import { type DocHandle } from "@automerge/automerge-repo";
import { CommentThreadForUI, MarkdownDoc } from "../schema";

import { amRangeToCMRange, jsxToHtmlElement, useStaticCallback } from "@/utils";
import isEqual from "lodash/isEqual";
import sortBy from "lodash/sortBy";
import { Tree } from "@lezer/common";

import {
  syntaxHighlighting,
  indentOnInput,
  foldGutter,
  foldKeymap,
  indentUnit,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { completionKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";

import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { markdownStyles, essayTheme } from "../codemirrorPlugins/theme";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import {
  setThreadsEffect,
  threadDecorations,
  threadsField,
} from "../codemirrorPlugins/commentThreads";

import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@automerge/automerge-repo-react-hooks";
import { useCurrentAccount, useSelf } from "@/account";

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
  setActiveThreadId: (threadId: string | null) => void;
  threadsWithPositions: CommentThreadForUI[];
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
  ".cm-gutters": {
    display: "none",
  },
  ".cm-content": {
    height: "100%",
    fontFamily: '"Merriweather", serif',
    padding: "10px 0",
    margin: "0 var(--cm-padding-x)",
    textAlign: "justify",
    lineHeight: "24px",
  },
  ".cm-content li": {
    marginBottom: 0,
  },
  ".cm-activeLine": {
    backgroundColor: "inherit",
  },
  ".cm-comment-thread": {
    backgroundColor: "rgb(255 249 194)",
  },
  ".cm-comment-thread.active": {
    backgroundColor: "rgb(255 227 135)",
  },
  // active highlighting wins if it's inside another thread
  ".cm-comment-thread.active .cm-comment-thread": {
    backgroundColor: "rgb(255 227 135)",
  },
  ".frontmatter": {
    fontFamily: "monospace",
    color: "#666",
    textDecoration: "none",
    fontWeight: "normal",
    lineHeight: "0.8em",
  },

  // cursor
  ".cm-ySelection": {},
  ".cm-yLineSelection": {
    padding: 0,
    margin: "0px 2px 0px 4px",
  },
  ".cm-ySelectionCaret": {
    position: "relative",
    borderLeft: "1px solid black",
    borderRight: "1px solid black",
    marginLeft: "-1px",
    marginRight: "-1px",
    boxSizing: "border-box",
    display: "inline",
  },
  ".cm-ySelectionCaretDot": {
    borderRadius: "50%",
    position: "absolute",
    width: ".4em",
    height: ".4em",
    top: "-.2em",
    left: "-.2em",
    backgroundColor: "inherit",
    transition: "transform .3s ease-in-out",
    boxSizing: "border-box",
  },
  ".cm-ySelectionCaret:hover > .cm-ySelectionCaretDot": {
    transformOrigin: "bottom center",
    transform: "scale(0)",
  },
  ".cm-ySelectionInfo": {
    position: "absolute",
    top: "-1.05em",
    left: "-1px",
    fontSize: ".75em",
    fontFamily: "serif",
    fontStyle: "normal",
    fontWeight: "normal",
    lineHeight: "normal",
    userSelect: "none",
    color: "white",
    paddingLeft: "2px",
    paddingRight: "2px",
    zIndex: 101,
    transition: "opacity .3s ease-in-out",
    backgroundColor: "inherit",
    // these should be separate
    opacity: 0,
    transitionDelay: "0s",
    whiteSpace: "nowrap",
  },
  ".cm-ySelectionCaret:hover > .cm-ySelectionInfo": {
    opacity: 1,
    transitionDelay: "0s",
  },
});

const baseHeadingStyles = {
  fontFamily: '"Merriweather Sans", sans-serif',
  fontWeight: 400,
  textDecoration: "none",
};

const baseCodeStyles = {
  fontFamily: "monospace",
  fontSize: "14px",
};

const markdownStyles = HighlightStyle.define([
  {
    tag: tags.heading1,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading2,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading3,
    ...baseHeadingStyles,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading4,
    ...baseHeadingStyles,
    fontSize: "1.1rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.comment,
    color: "#555",
    fontFamily: "monospace",
  },
  {
    tag: tags.strong,
    fontWeight: "bold",
  },
  {
    tag: tags.emphasis,
    fontStyle: "italic",
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
  },
  {
    tag: [tags.meta],
    fontWeight: 300,
    color: "#888",
    fontFamily: '"Merriweather Sans", sans-serif',
  },
  { tag: tags.keyword, ...baseCodeStyles, color: "#708" },
  {
    tag: [
      tags.atom,
      tags.bool,
      tags.url,
      tags.contentSeparator,
      tags.labelName,
    ],
    ...baseCodeStyles,
    color: "#219",
  },
  { tag: [tags.literal, tags.inserted], ...baseCodeStyles, color: "#164" },
  { tag: [tags.string, tags.deleted], ...baseCodeStyles, color: "#5f67b5" },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    ...baseCodeStyles,
    color: "#e40",
  },
  { tag: tags.definition(tags.variableName), ...baseCodeStyles, color: "#00f" },
  { tag: tags.local(tags.variableName), ...baseCodeStyles, color: "#30a" },
  { tag: [tags.typeName, tags.namespace], ...baseCodeStyles, color: "#085" },
  { tag: tags.className, ...baseCodeStyles, color: "#167" },
  {
    tag: [tags.special(tags.variableName), tags.macroName],
    ...baseCodeStyles,
    color: "#256",
  },
  { tag: tags.definition(tags.propertyName), ...baseCodeStyles, color: "#00c" },
]);

interface Cursor {
  name: string;
  position: number | undefined;
}

const setCursorsEffect = StateEffect.define<Cursor[]>();
const cursorsField = StateField.define<Cursor[]>({
  create() {
    return [];
  },
  update(highlights, tr) {
    for (let e of tr.effects) {
      if (e.is(setCursorsEffect)) {
        return e.value;
      }
    }

    return highlights;
    return highlights.map(
      (cursor): Cursor => ({
        ...cursor,
        position: tr.changes.mapPos(cursor.position),
      })
    );
  },
});

const cursorDecorations = EditorView.decorations.compute(
  [cursorsField],
  (state) => {
    const cursors = state.field(cursorsField);

    const decorations = [];

    cursors.forEach((cursor) => {
      if (cursor.position !== undefined) {
        decorations.push(
          Decoration.widget({
            side: 1,
            widget: new YRemoteCaretWidget("red", cursor.name),
          }).range(cursor.position)
        );
      }
    });

    console.log("decorations", decorations, cursors);

    return Decoration.set(decorations);
  }
);

export function MarkdownEditor({
  handle,
  path,
  setSelection,
  setView,
  setActiveThreadId,
  threadsWithPositions,
}: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);
  const [editorCrashed, setEditorCrashed] = useState<boolean>(false);

  const self = useSelf();
  const name = !self || self.type === "anonymous" ? "anonymous" : self.name;
  const [cursorPosition, setCursorPosition] = useState(0);

  const account = useCurrentAccount();

  /*useEffect(() => {
    if (!editorRoot.current) {
      return;
    }

    console.log("set");

    editorRoot.current.dispatch({
      effects: setCursorsEffect.of([
        {
          position: 10,
          name: "bob",
        },
      ]),
    });
  }, [editorRoot.current]); */

  const [_, setCursor] = useLocalAwareness({
    handle,
    userId: account?.contactHandle.url,
    initialState: undefined,
  });

  useEffect(() => {
    setCursor({ name, position: cursorPosition });
  }, [cursorPosition, name]);

  const [peerStates] = useRemoteAwareness({
    handle,
    localUserId: account?.contactHandle.url,
  });

  useEffect(() => {
    if (!editorRoot.current) {
      return;
    }

    const activeCursors: Cursor[] = Object.values(peerStates);

    editorRoot.current.dispatch({
      effects: setCursorsEffect.of(activeCursors),
    });
  }, [peerStates, editorRoot.current]);

  // Propagate activeThreadId into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setThreadsEffect.of(threadsWithPositions),
    });
  }, [threadsWithPositions]);

  useEffect(() => {
    const doc = handle.docSync();
    const source = doc.content; // this should use path
    const automergePlugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(automergePlugin);
    const view = new EditorView({
      doc: source,
      extensions: [
        // Start with a variety of basic plugins, subset of Codemirror "basic setup" kit:
        // https://github.com/codemirror/basic-setup/blob/main/src/codemirror.ts
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        EditorView.lineWrapping,
        essayTheme,
        markdown({
          codeLanguages: languages,
        }),
        indentUnit.of("    "),
        syntaxHighlighting(markdownStyles),

        // Now our custom stuff: Automerge collab, comment threads, etc.
        automergePlugin,
        frontmatterPlugin,
        threadsField,
        threadDecorations,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        cursorsField,
        cursorDecorations,
      ],
      dispatch(transaction, view) {
        if (transaction.selection) {
          setTimeout(() => {
            setCursorPosition(
              editorRoot.current.state.selection.ranges[0].from
            );
          });
        }

        // TODO: can some of these dispatch handlers be factored out into plugins?
        try {
          const newSelection = transaction.newSelection.ranges[0];
          if (transaction.newSelection !== view.state.selection) {
            // set the active thread id if our selection is in a thread
            for (const thread of view.state.field(threadsField)) {
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
            yCoord:
              -1 * view.scrollDOM.getBoundingClientRect().top +
              view.coordsAtPos(selection.from).top,
          });
        } catch (e) {
          // If we hit an error in dispatch, it can lead to bad situations where
          // the editor has crashed and isn't saving data but the user keeps typing.
          // To avoid this, we hard crash so the user knows things are broken and reloads
          // before they lose data.

          console.error(
            "Encountered an error in dispatch function; crashing the editor to notify the user and avoid data loss."
          );
          console.error(e);
          setEditorCrashed(true);
          editorRoot.current?.destroy();
        }
      },
      parent: containerRef.current,
    });

    editorRoot.current = view;

    // pass the view up to the parent so it can use it too
    setView(view);

    const handleChange = () => {
      semaphore.reconcile(handle, view);
    };

    handleChange();

    handle.addListener("change", handleChange);

    return () => {
      handle.removeListener("change", handleChange);
      view.destroy();
    };
  }, [handle]);

  if (editorCrashed) {
    return (
      <div className="bg-red-100 p-4 rounded-md">
        <p className="mb-2">⛔️ Error: editor crashed!</p>
        {import.meta.env.MODE === "development" && (
          <p className="mb-2">Probably due to hot reload in dev.</p>
        )}
        <p className="mb-2">
          We're sorry for the inconvenience. Please reload to keep working. Your
          data was most likely saved before the crash.
        </p>
        <p className="mb-2">
          If you'd like you can screenshot the dev console as a bug report.
        </p>
      </div>
    );
  }

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
