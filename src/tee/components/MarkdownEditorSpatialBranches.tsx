// This is a radically simplified version of our full editor
// that's intended to show a read-only view of a string with correct formatting and with diff annotations.

import { useEffect, useRef, useState } from "react";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { dropCursor, EditorView } from "@codemirror/view";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "../codemirrorPlugins/automerge-codemirror";

import { DocHandle } from "@automerge/automerge-repo";
import {
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  annotationDecorations,
  annotationsField,
} from "../codemirrorPlugins/annotations";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import {
  DebugHighlight,
  debugHighlightsDecorations,
  debugHighlightsField,
  setDebugHighlightsEffect,
} from "../codemirrorPlugins/DebugHighlight";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { essayTheme, markdownStyles } from "../codemirrorPlugins/theme";
import { MarkdownDoc } from "../schema";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export function MarkdownEditorSpatialBranches({
  handle,
  debugHighlights,
  setSelection,
}: {
  handle: DocHandle<MarkdownDoc>;
  debugHighlights?: DebugHighlight[];
  setSelection: (selection: TextSelection) => void;
}) {
  const containerRef = useRef(null);
  const [editorRoot, setEditorRoot] = useState<EditorView>();

  // Propagate debug highlights into codemirror
  useEffect(() => {
    editorRoot?.dispatch({
      effects: setDebugHighlightsEffect.of(debugHighlights ?? []),
    });
  }, [debugHighlights, editorRoot]);

  useEffect(() => {
    const doc = handle.docSync();
    const automergePlugin = amgPlugin(doc, ["content"]);
    const semaphore = new PatchSemaphore(automergePlugin);

    const view = new EditorView({
      doc: doc.content,
      extensions: [
        dropCursor(),
        EditorView.lineWrapping,
        essayTheme,
        markdown({
          codeLanguages: languages,
        }),
        indentUnit.of("    "),
        indentOnInput(),
        syntaxHighlighting(markdownStyles),

        // Now our custom stuff: Automerge collab, comment threads, etc.
        frontmatterPlugin,
        annotationsField,
        annotationDecorations,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
        debugHighlightsField,
        debugHighlightsDecorations,
        automergePlugin,
      ],
      dispatch(transaction, view) {
        view.update([transaction]);

        // todo: sync to branches

        //        semaphore.reconcile(handle, view);

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
      },
      parent: containerRef.current,
    });

    setEditorRoot(view);

    const handleChange = () => {
      semaphore.reconcile(handle, view);
    };

    handleChange();

    handle.addListener("change", handleChange);

    return () => {
      handle.removeListener("change", handleChange);
      view.destroy();
    };
  }, [containerRef]);

  return (
    <div className="flex flex-col items-stretch">
      <div
        className="codemirror-editor flex-grow relative"
        ref={containerRef}
      />
    </div>
  );
}
