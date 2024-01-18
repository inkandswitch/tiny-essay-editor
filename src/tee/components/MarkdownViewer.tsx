import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { dropCursor, EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";

import { completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import { searchKeymap } from "@codemirror/search";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { essayTheme, markdownStyles } from "../codemirrorPlugins/theme";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export type DiffStyle = "normal" | "pencil";

export type ViewerProps = {
  text: string;
};

export function MarkdownViewer({ text }: ViewerProps) {
  const containerRef = useRef(null);
  const [editorView, setEditorView] = useState<EditorView>();

  // setup codemirror
  useEffect(() => {
    const view = new EditorView({
      doc: text,
      extensions: [
        EditorView.editable.of(false),
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

        frontmatterPlugin,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
      ],
      parent: containerRef.current,
    });

    setEditorView(view);

    return () => {
      view.destroy();
    };
  }, []);

  // update text
  useEffect(() => {
    if (!editorView || editorView.state.doc.toString() === text) {
      return;
    }

    editorView.dispatch(
      editorView.state.update({
        changes: { from: 0, to: editorView.state.doc.length, insert: text },
      })
    );
  }, [editorView, text]);

  return <div className="codemirror-editor" ref={containerRef} />;
}
