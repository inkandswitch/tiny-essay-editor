import { useEffect, useRef, useState } from "react";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { dropCursor, EditorView, keymap } from "@codemirror/view";

import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { type DocHandle } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  codeFolding,
  foldEffect,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { searchKeymap } from "@codemirror/search";
import { SelectionRange } from "@codemirror/state";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import {
  setAnnotationsEffect,
  annotationDecorations,
  annotationsField,
} from "../codemirrorPlugins/annotations";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { essayTheme, markdownStyles } from "../codemirrorPlugins/theme";
import {
  TextAnnotationForUI,
  MarkdownDoc,
  DiscussionAnotationForUI,
} from "../schema";
import { previewImagesPlugin } from "../codemirrorPlugins/previewMarkdownImages";
import {
  setPatchesEffect,
  patchesField,
  patchDecorations,
} from "../codemirrorPlugins/patchDecorations";
import {
  DebugHighlight,
  setDebugHighlightsEffect,
  debugHighlightsField,
  debugHighlightsDecorations,
} from "../codemirrorPlugins/DebugHighlight";
import { TextPatch } from "@/patchwork/utils";
import {
  discussionTargetPositionListener,
  DiscussionTargetPosition,
} from "../codemirrorPlugins/discussionTargetPositionListener";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export type DiffStyle = "normal" | "private";

export type EditorProps = {
  handle: DocHandle<MarkdownDoc>;
  path: A.Prop[];
  setSelection: (selection: TextSelection) => void;
  setView: (view: EditorView) => void;
  setActiveThreadIds: (threadIds: string[]) => void;
  threadsWithPositions: TextAnnotationForUI[];
  discussionAnnotations?: DiscussionAnotationForUI[];
  readOnly?: boolean;
  docHeads?: A.Heads;
  diff?: (A.Patch | TextPatch)[];
  diffStyle: DiffStyle;
  debugHighlights?: DebugHighlight[];
  onOpenSnippet?: (range: SelectionRange) => void;
  foldRanges?: { from: number; to: number }[];
  onUpdateDiscussionTargetPositions?: (
    positions: DiscussionTargetPosition[]
  ) => void;
};

export function MarkdownEditor({
  handle,
  path,
  setSelection,
  setView,
  setActiveThreadIds,
  threadsWithPositions: annotationsWithPositions,
  readOnly,
  docHeads,
  diff,
  diffStyle,
  debugHighlights,
  onOpenSnippet,
  foldRanges,
  discussionAnnotations,
  onUpdateDiscussionTargetPositions,
}: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);
  const [editorCrashed, setEditorCrashed] = useState<boolean>(false);

  const handleReady = handle.isReady();

  // Propagate debug highlights into codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setDebugHighlightsEffect.of(debugHighlights ?? []),
    });
  }, [debugHighlights, editorRoot.current]);

  // propagate fold ranges into codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: (foldRanges ?? []).map((range) => foldEffect.of(range)),
    });
  }, [foldRanges, editorRoot.current]);

  // Propagate patches into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      // split up replaces
      effects: setPatchesEffect.of(
        (diff ?? []).flatMap(
          (patch) =>
            patch.action === "replace"
              ? [patch.raw.splice, patch.raw.delete]
              : [patch] // unpack replaces
        )
      ),
    });
  }, [diff, editorRoot.current]);

  // Propagate comments and edit group annotations into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setAnnotationsEffect.of(
        annotationsWithPositions
          .flatMap((annotation) => {
            switch (annotation.type) {
              case "thread": {
                return annotation;
              }
              case "patch": {
                return annotation;
              }
              case "draft": {
                return annotation.editRangesWithComments.map((range) => ({
                  id: annotation.id,
                  from: range.editRange.from,
                  to: range.editRange.to,
                  active: annotation.active,
                }));
              }
              default: {
                return [];
              }
            }
          })
          .concat(discussionAnnotations)
      ),
    });
  }, [annotationsWithPositions, discussionAnnotations]);

  useEffect(() => {
    if (!handleReady) {
      return;
    }
    const doc = handle.docSync();
    const docAtHeads = docHeads ? A.view(doc, docHeads) : doc;
    const source = docAtHeads.content; // this should use path

    const automergePlugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(automergePlugin);
    const view = new EditorView({
      doc: source,
      extensions: [
        EditorView.editable.of(!readOnly),
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
          {
            key: "Mod-o",
            run: () => {
              const selectedRange = view.state.selection.main;
              onOpenSnippet(selectedRange);
              return true;
            },
            preventDefault: true,
            stopPropagation: true,
          },
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
        annotationsField,
        annotationDecorations,
        patchesField,
        patchDecorations(diffStyle ?? "normal"),
        previewFiguresPlugin,
        previewImagesPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
        debugHighlightsField,
        debugHighlightsDecorations,
        codeFolding({
          placeholderDOM: () => {
            // TODO use a nicer API for creating these elements?
            const placeholder = document.createElement("div");
            placeholder.className = "cm-foldPlaceholder";
            placeholder.style.padding = "10px";
            placeholder.style.marginTop = "5px";
            placeholder.style.marginBottom = "5px";
            placeholder.style.fontSize = "14px";
            placeholder.style.fontFamily = "Fira Code";
            placeholder.style.textAlign = "center";
            placeholder.innerText = "N lines hidden";
            return placeholder;
          },
        }),
        ...(onUpdateDiscussionTargetPositions
          ? [
              discussionTargetPositionListener(
                onUpdateDiscussionTargetPositions
              ),
            ]
          : []),
      ],
      dispatch(transaction, view) {
        // TODO: can some of these dispatch handlers be factored out into plugins?
        try {
          view.update([transaction]);

          semaphore.reconcile(handle, view);
          const selection = view.state.selection.ranges[0];
          if (selection) {
            setSelection({
              from: selection.from,
              to: selection.to,
              yCoord:
                -1 * view.scrollDOM.getBoundingClientRect().top +
                  view.coordsAtPos(selection.from)?.top ?? 0,
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

    const handleChange = () => {
      semaphore.reconcile(handle, view);
    };

    handleChange();

    handle.addListener("change", handleChange);

    return () => {
      handle.removeListener("change", handleChange);
      view.destroy();
    };
  }, [handle, handleReady, docHeads]);

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
          // Let cmd-g thru for grouping annotations
          if (evt.key === "g" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          // Let cmd-g thru for grouping annotations
          if (evt.key === "`" && (evt.metaKey || evt.ctrlKey)) {
            return;
          }
          evt.stopPropagation();
        }}
      />
    </div>
  );
}
