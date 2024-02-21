import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
} from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

import { Prop } from "@automerge/automerge";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { indentWithTab } from "@codemirror/commands";
import { type DocHandle } from "@automerge/automerge-repo";
import { CommentThreadForUI, MarkdownDoc } from "../schema";
import {
  syntaxHighlighting,
  indentOnInput,
  foldKeymap,
  indentUnit,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
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
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import {
  type SelectionData,
  collaborativePlugin,
  setPeerSelectionData,
} from "../codemirrorPlugins/remoteCursors";
import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@/vendor/vendored-automerge-repo/packages/automerge-repo-react-hooks/dist";
import { useCurrentAccount } from "@/DocExplorer/account";

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

  const handleReady = handle.isReady();

  const account = useCurrentAccount();

  // TODO: "loading"
  const userId = account?.contactHandle?.url;
  const userDoc = account?.contactHandle?.docSync();

  // Initialize userMetadata as a ref
  const userMetadataRef = useRef({ name: "Anonymous", color: "pink", userId });

  useEffect(() => {
    if (userDoc) {
      if (userDoc.type === "registered") {
        const { color, name } = userDoc;
        // Update the ref directly
        userMetadataRef.current = {
          ...userMetadataRef.current,
          color,
          name,
          userId,
        };
      } else {
        userMetadataRef.current = { ...userMetadataRef.current, userId };
      }
    }
  }, [userId, userDoc]);

  const [, setLocalSelections] = useLocalAwareness({
    handle,
    userId,
    initialState: {},
  });
  const [remoteSelections] = useRemoteAwareness({
    handle,
    localUserId: userId,
  });
  const [lastSelections, setLastSelections] = useState(remoteSelections);

  // Propagate activeThreadId into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setThreadsEffect.of(threadsWithPositions),
    });
  }, [threadsWithPositions]);

  useEffect(() => {
    // compare the new selections to the last selections
    // if they are different, update the codemirror
    // we need to do a deep comparison because the object reference will change
    /*    if (JSON.stringify(remoteSelections) === JSON.stringify(lastSelections)) {
      return; // bail out
    }
    setLastSelections(remoteSelections);
*/

    const peerSelections = Object.entries(remoteSelections).map(
      ([userId, selection]) => {
        return {
          userId,
          ...selection,
        };
      }
    );

    console.log("peerSelections", peerSelections);

    /*
    editorRoot.current?.dispatch({
      effects: setPeerSelectionData.of(peerSelections),
    });*/
  }, [remoteSelections, lastSelections]);

  const setLocalSelectionsWithUserData = useCallback(
    (selection: SelectionData) => {
      const localSelections = {
        user: userMetadataRef.current, // Access the current value of the ref
        selection,
        userId: userMetadataRef.current.userId, // Ensure you're using the ref's current value
      };
      setLocalSelections(localSelections);
    },
    [setLocalSelections, userMetadataRef]
  );

  useEffect(() => {
    if (!handleReady) {
      return;
    }
    const doc = handle.docSync();
    const source = doc.content; // this should use path
    const automergePlugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(automergePlugin);
    const cursorPlugin = collaborativePlugin(
      doc,
      path,
      setLocalSelectionsWithUserData
    );
    const view = new EditorView({
      doc: source,
      extensions: [
        // Start with a variety of basic plugins, subset of Codemirror "basic setup" kit:
        // https://github.com/codemirror/basic-setup/blob/main/src/codemirror.ts
        history(),

        // GL 1/10/24: I'm disabling this plugin for now because it was causing weird issues with
        // rectangular selection, and it doesn't provide any obvious benefit at the moment.
        // In the future we might want to bring it back though.
        // drawSelection(),

        dropCursor(),
        indentOnInput(),
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
        cursorPlugin,
        frontmatterPlugin,
        threadsField,
        threadDecorations,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
      ],
      dispatch(transaction, view) {
        // TODO: can some of these dispatch handlers be factored out into plugins?
        try {
          /*const newSelection = transaction.newSelection.ranges[0];
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
          }*/
          view.update([transaction]);
          semaphore.reconcile(handle, view);
          /*const selection = view.state.selection.ranges[0];
          setSelection({
            from: selection.from,
            to: selection.to,
            yCoord:
              -1 * view.scrollDOM.getBoundingClientRect().top +
              view.coordsAtPos(selection.from).top,
          });*/
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

    view.focus();

    const handleChange = () => {
      semaphore.reconcile(handle, view);
    };

    handleChange();

    handle.addListener("change", handleChange);

    return () => {
      handle.removeListener("change", handleChange);
      view.destroy();
    };
  }, [handle, handleReady]);

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
          // Let cmd-\ thru for toggling the sidebar
          if (evt.key === "\\" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          evt.stopPropagation();
        }}
      />
    </div>
  );
}
