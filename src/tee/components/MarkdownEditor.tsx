import React, { useEffect, useRef, useState } from "react";

import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
} from "@codemirror/view";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

import { change, Prop } from "@automerge/automerge";
import { automergeSyncPlugin } from "@automerge/automerge-codemirror";
import { indentWithTab } from "@codemirror/commands";
import { type DocHandle } from "@automerge/automerge-repo";
import { CommentThreadForUI, MarkdownDoc } from "../schema";
import {
  syntaxHighlighting,
  indentOnInput,
  foldKeymap,
  indentUnit,
} from "@codemirror/language";
import { history, historyKeymap, standardKeymap } from "@codemirror/commands";
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
import { dragAndDropImagesPlugin } from "../codemirrorPlugins/dragAndDropImages";
import { previewImagesPlugin } from "../codemirrorPlugins/previewMarkdownImages";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { AssetsDoc } from "../assets";

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
  const repo = useRepo();
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);
  const [editorCrashed, setEditorCrashed] = useState<boolean>(false);

  const handleReady = handle.isReady();

  // Propagate activeThreadId into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setThreadsEffect.of(threadsWithPositions),
    });
  }, [threadsWithPositions]);

  useEffect(() => {
    if (!handleReady) {
      return;
    }
    const doc = handle.docSync();
    const source = doc.content; // this should use path
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
        dragAndDropImagesPlugin({
          createImageReference: async (file) => {
            const doc = handle.docSync();
            let assetsHandle: DocHandle<AssetsDoc>;

            if (!doc.assetsDocUrl) {
              // add assets doc to old documents
              assetsHandle = repo.create<AssetsDoc>();
              assetsHandle.change((assetsDoc) => {
                assetsDoc.files = {};
              });
              handle.change((doc) => {
                doc.assetsDocUrl = assetsHandle.url;
              });
            } else {
              assetsHandle = repo.find<AssetsDoc>(doc.assetsDocUrl);
            }

            await assetsHandle.whenReady();
            const assetsDoc = assetsHandle.docSync();

            const fileAlreadyExists = assetsDoc.files[file.name];
            if (fileAlreadyExists) {
              alert(
                `a file with the name "${file.name}" already exists in the document`
              );
              return;
            }

            const contents = await loadFile(file);

            assetsHandle.change((assetsDoc) => {
              assetsDoc.files[file.name] = {
                contentType: file.type,
                contents,
              };
            });

            return `![](./assets/${file.name})`;
          },
        }),
        indentOnInput(),
        keymap.of([
          ...standardKeymap,
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
        automergeSyncPlugin({
          handle,
          path: ["content"],
        }),
        frontmatterPlugin,
        threadsField,
        threadDecorations,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
        previewImagesPlugin,
      ],
      dispatch(transaction, view) {
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

          const selection = view.state.selection.ranges[0];
          const coords = view.coordsAtPos(selection.from);

          if (coords) {
            setSelection({
              from: selection.from,
              to: selection.to,
              yCoord:
                -1 * view.scrollDOM.getBoundingClientRect().top + coords.top,
            });
          }
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

    return () => {
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

const loadFile = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      // The file's text will be printed here
      const arrayBuffer = e.target.result as ArrayBuffer;

      // Convert the arrayBuffer to a Uint8Array
      resolve(new Uint8Array(arrayBuffer));
    };

    reader.readAsArrayBuffer(file);
  });
};
