// This is a radically simplified version of our full editor
// that's intended to show a read-only view of a string with correct formatting and with diff annotations.

import { useEffect, useRef } from "react";

import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  Decoration,
  dropCursor,
  EditorView,
  WidgetType,
} from "@codemirror/view";

import * as A from "@automerge/automerge/next";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { codeMonospacePlugin } from "../codemirrorPlugins/codeMonospace";
import {
  threadDecorations,
  threadsField,
} from "../codemirrorPlugins/commentThreads";
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

export type DiffStyle = "normal" | "private";

export function ReadonlySnippetView({
  text,
  patches,
}: {
  text: string;
  patches: A.Patch[];
}) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);

  useEffect(() => {
    const source = text; // this should use path

    const view = new EditorView({
      doc: source,
      extensions: [
        EditorView.editable.of(false),
        dropCursor(),
        EditorView.lineWrapping,
        essayTheme,
        markdown({
          codeLanguages: languages,
        }),
        indentUnit.of("    "),
        syntaxHighlighting(markdownStyles),

        // Now our custom stuff: Automerge collab, comment threads, etc.
        frontmatterPlugin,
        threadsField,
        threadDecorations,
        patchDecorations(patches, "normal"),
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
      ],
      dispatch(transaction, view) {
        view.update([transaction]);
      },
      parent: containerRef.current,
    });

    editorRoot.current = view;

    return () => {
      view.destroy()
    }
  }, [text, patches]);

  return (
    <div className="flex flex-col items-stretch">
      <div
        className="codemirror-editor flex-grow relative"
        ref={containerRef}
      />
    </div>
  );
}

// Stuff for patches decoration
// TODO: move this into a separate file

class DeletionMarker extends WidgetType {
  constructor() {
    super();
  }

  toDOM(): HTMLElement {
    const box = document.createElement("div");
    box.style.display = "inline-block";
    box.style.boxSizing = "border-box";
    box.style.padding = "0 2px";
    box.style.color = "rgb(236 35 35)";
    box.style.margin = "0 4px";
    box.style.fontSize = "0.8em";
    box.style.backgroundColor = "rgb(255 0 0 / 10%)";
    box.style.borderRadius = "3px";
    box.innerText = "⌫";
    return box;
  }

  eq() {
    // todo: i think this is right for now until we show hover of del text etc
    return true;
  }

  ignoreEvent() {
    return true;
  }
}

const privateDecoration = Decoration.mark({ class: "cm-patch-private" });
const spliceDecoration = Decoration.mark({ class: "cm-patch-splice" });
const deleteDecoration = Decoration.widget({
  widget: new DeletionMarker(),
  side: 1,
});

const patchDecorations = (patches: A.Patch[], diffStyle: DiffStyle) => {
  const filteredPatches = patches.filter(
    (patch) => patch.path[0] === "content"
  );

  const decorations = filteredPatches.flatMap((patch) => {
    switch (patch.action) {
      case "splice": {
        const from = patch.path[1];
        const length = patch.value.length;
        const decoration =
          diffStyle === "private" ? privateDecoration : spliceDecoration;
        return [decoration.range(from, from + length)];
      }
      case "del": {
        if (patch.path.length < 2) {
          console.error("this is so weird! why??");
          return [];
        }
        const from = patch.path[1];
        return [deleteDecoration.range(from)];
      }
    }
    return [];
  });

  return EditorView.decorations.of(Decoration.set(decorations));
};
