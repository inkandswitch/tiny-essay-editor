// This plugin inserts a table of contents into the document based on headings.

import React from "react";
import { Range } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import {
  WidgetType,
  EditorView,
  Decoration,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
} from "@codemirror/view";
import { isEqual } from "lodash";
import { Tree } from "@lezer/common";
import { jsxToHtmlElement } from "../../../datatypes/markdown/utils";

type Heading = { level: number; content: string; from: number; to: number };

type HeadingTree = {
  level: "h2";
  content: string;
  from: number;
  to: number;
  children: { level: "h3"; content: string; from: number; to: number }[];
}[];

class TableOfContentsWidget extends WidgetType {
  constructor(protected headings: HeadingTree) {
    super();
  }

  toDOM() {
    return jsxToHtmlElement(
      <div className="font-sans bg-customGray py-1 px-8 mx-[-20px]">
        <h2>Contents</h2>
        {this.headings.map((h2) => (
          <div key={`${h2.from}-${h2.to}`}>
            <h3>{h2.content}</h3>
            {h2.children.length > 0 && (
              <ul>
                {h2.children.map((h3) => (
                  <li key={`${h3.from}-${h3.to}`}>{h3.content}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  }

  eq(other: TableOfContentsWidget) {
    return isEqual(other.headings, this.headings);
  }

  ignoreEvent() {
    return true;
  }
}

// [TOC] is a standard command for inserting a TOC into Markdown.
// endintro is used by the I&S website hugo template.
const TOC_COMMAND_REGEX = /<!--endintro-->|\[TOC\]/;

function getTOCDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    const tocMatch = text.match(TOC_COMMAND_REGEX);

    if (tocMatch) {
      const position = tocMatch.index + from;
      const markdownTree = ensureSyntaxTree(view.state, view.state.doc.length);

      const headingsList: Heading[] = [];
      const dfs = (tree: Tree, position: number) => {
        let level = 0;
        switch (tree.type.name) {
          case "ATXHeading1": {
            level = 1;
            break;
          }
          case "ATXHeading2": {
            level = 2;
            break;
          }
          case "ATXHeading3": {
            level = 3;
            break;
          }
          case "ATXHeading4": {
            level = 4;
            break;
          }
        }
        if (level !== 0) {
          const from = position + tree.children[0].length; // Chop off the ## at the beginning
          const to = position + tree.length;
          const text = view.state.doc.sliceString(from, to);

          headingsList.push({
            level,
            content: text,
            from,
            to,
          });
        }

        tree.positions.forEach((childPos, index) => {
          const child = tree.children[index];
          if (child instanceof Tree) {
            dfs(child, position + childPos);
          }
        });
      };
      dfs(markdownTree, 0);

      const headingTree: HeadingTree = [];

      headingsList.forEach((item) => {
        if (item.level === 2) {
          headingTree.push({
            level: "h2",
            content: item.content,
            children: [],
            from: item.from,
            to: item.to,
          });
        } else if (item.level === 3 && headingTree.length) {
          headingTree[headingTree.length - 1].children.push({
            level: "h3",
            content: item.content,
            from: item.from,
            to: item.to,
          });
        }
      });

      const widget = Decoration.widget({
        widget: new TableOfContentsWidget(headingTree),
        side: 1,
      }).range(position + tocMatch[0].length);

      decorations.push(widget);

      decorations.push(
        Decoration.mark({
          class:
            "text-gray-500 font-mono text-left text-sm leading-snug inline-block opacity-70 mb-1",
        }).range(position, position + tocMatch[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

export const tableOfContentsPreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getTOCDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getTOCDecorations(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
