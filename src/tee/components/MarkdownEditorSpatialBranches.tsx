// This is a radically simplified version of our full editor
// that's intended to show a read-only view of a string with correct formatting and with diff annotations.

import { useEffect, useRef, useState } from "react";

import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "../codemirrorPlugins/automerge-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { dropCursor, EditorView } from "@codemirror/view";

import {
  AutomergeUrl,
  DocHandle,
  DocHandleChangePayload,
} from "@automerge/automerge-repo";
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
import { Branch, MarkdownDoc } from "../schema";
import { next as A } from "@automerge/automerge";
import { useRepo } from "@automerge/automerge-repo-react-hooks";

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

  const combinedDocHandle = useCombinedDocHandle(handle);

  // Propagate debug highlights into codemirror
  useEffect(() => {
    editorRoot?.dispatch({
      effects: setDebugHighlightsEffect.of(debugHighlights ?? []),
    });
  }, [debugHighlights, editorRoot]);

  useEffect(() => {
    if (!combinedDocHandle) {
      return;
    }

    const doc = combinedDocHandle.docSync();
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
        console.log("edit not implemtented");

        view.update([transaction]);

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
  }, [containerRef, combinedDocHandle]);

  return (
    <div className="flex flex-col items-stretch">
      <div
        className="codemirror-editor flex-grow relative"
        ref={containerRef}
      />
    </div>
  );
}

function useCombinedDocHandle(
  handle: DocHandle<MarkdownDoc>
): DocHandle<MarkdownDoc> | undefined {
  const repo = useRepo();

  const [combinedHandle, setCombinedHandle] =
    useState<DocHandle<MarkdownDoc>>();

  useEffect(() => {
    const combinedHandle = repo.create<MarkdownDoc>(); // todo: this doc only needs to exist ephemeraly

    const branchHandlesByUrl = new Map<AutomergeUrl, DocHandle<MarkdownDoc>>();

    const onChangeDoc = ({
      doc,
      handle,
    }: DocHandleChangePayload<MarkdownDoc>) => {
      updateBranches(doc.branches ?? []);
      combinedHandle.merge(handle);
    };

    const updateBranches = (branches: Branch[]) => {
      // todo: delete branches

      for (const branch of branches) {
        if (!branchHandlesByUrl.has(branch.docUrl)) {
          const handle = repo.find<MarkdownDoc>(branch.docUrl);
          combinedHandle.merge(handle);
          branchHandlesByUrl.set(branch.docUrl, handle);
        }
      }
    };

    const onChangeBranch = ({
      handle,
    }: DocHandleChangePayload<MarkdownDoc>) => {
      combinedHandle.merge(handle);
    };

    combinedHandle.merge(handle);

    handle.doc().then((doc) => {
      if (doc.branches) {
        updateBranches(doc.branches);
      }

      setCombinedHandle(combinedHandle);
    });

    handle.on("change", onChangeDoc);

    return () => {
      handle.off("change", onChangeDoc);

      for (const branchHandle of branchHandlesByUrl.values()) {
        branchHandle.off("change", onChangeBranch);
      }
    };
  }, [handle]);

  return combinedHandle;
}
