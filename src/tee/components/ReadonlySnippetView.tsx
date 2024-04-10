// This is a radically simplified version of our full editor
// that's intended to show a read-only view of a string with correct formatting and with diff annotations.

import { useEffect, useRef, useState } from "react";

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
  annotationDecorations,
  annotationsField,
} from "../codemirrorPlugins/annotationDecorations";
import { frontmatterPlugin } from "../codemirrorPlugins/frontmatter";
import { highlightKeywordsPlugin } from "../codemirrorPlugins/highlightKeywords";
import { lineWrappingPlugin } from "../codemirrorPlugins/lineWrapping";
import { previewFiguresPlugin } from "../codemirrorPlugins/previewFigures";
import { tableOfContentsPreviewPlugin } from "../codemirrorPlugins/tableOfContentsPreview";
import { essayTheme, markdownStyles } from "../codemirrorPlugins/theme";
import {
  DebugHighlight,
  setDebugHighlightsEffect,
  debugHighlightsField,
  debugHighlightsDecorations,
} from "../codemirrorPlugins/DebugHighlight";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export type DiffStyle = "normal" | "private";

export function ReadonlySnippetView({
  text,
  patches,
  debugHighlights,
  setSelection,
}: {
  text: string;
  patches?: A.Patch[];
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
        annotationsField,
        annotationDecorations,
        patchDecorations(patches ?? [], "normal"),
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
        lineWrappingPlugin,
        debugHighlightsField,
        debugHighlightsDecorations,
      ],
      dispatch(transaction, view) {
        view.update([transaction]);

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

    return () => {
      view.destroy();
    };
  }, [text, patches, setSelection]);

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
        const from = patch.path[1] as number;
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
        const from = patch.path[1] as number;
        return [deleteDecoration.range(from)];
      }
    }
    return [];
  });

  return EditorView.decorations.of(Decoration.set(decorations));
};
