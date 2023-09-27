/** @jsx jsx */
/* @jsxFrag React.Fragment */

import { useCallback, useMemo, useState } from "react";
import { css } from "@emotion/react";

import { createEditor, Text, Range, Node, Operation, Editor } from "slate";
import { withHistory } from "slate-history";
import { next as A } from "@automerge/automerge";
import { Editable, RenderLeafProps, Slate, withReact } from "slate-react";
import Prism, { Token } from "prismjs";

import { MarkdownDoc } from "./slate-automerge";

const withOpHandler = (editor: Editor, callback: (op: Operation) => void) => {
  const { apply } = editor;
  editor.apply = (op) => {
    apply(op);
    callback(op);
  };
  return editor;
};

// eslint-disable-next-line
// @ts-ignore
Prism.languages.markdown=Prism.languages.extend("markup",{}),Prism.languages.insertBefore("markdown","prolog",{blockquote:{pattern:/^>(?:[\t ]*>)*/m,alias:"punctuation"},code:[{pattern:/^(?: {4}|\t).+/m,alias:"keyword"},{pattern:/``.+?``|`[^`\n]+`/,alias:"keyword"}],title:[{pattern:/\w+.*(?:\r?\n|\r)(?:==+|--+)/,alias:"important",inside:{punctuation:/==+$|--+$/}},{pattern:/(^\s*)#+.+/m,lookbehind:!0,alias:"important",inside:{punctuation:/^#+|#+$/}}],hr:{pattern:/(^\s*)([*-])([\t ]*\2){2,}(?=\s*$)/m,lookbehind:!0,alias:"punctuation"},list:{pattern:/(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,lookbehind:!0,alias:"punctuation"},"url-reference":{pattern:/!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,inside:{variable:{pattern:/^(!?\[)[^\]]+/,lookbehind:!0},string:/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,punctuation:/^[\[\]!:]|[<>]/},alias:"url"},bold:{pattern:/(^|[^\\])(\*\*|__)(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,lookbehind:!0,inside:{punctuation:/^\*\*|^__|\*\*$|__$/}},italic:{pattern:/(^|[^\\])([*_])(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,lookbehind:!0,inside:{punctuation:/^[*_]|[*_]$/}},url:{pattern:/!?\[[^\]]+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)| ?\[[^\]\n]*\])/,inside:{variable:{pattern:/(!?\[)[^\]]+(?=\]$)/,lookbehind:!0},string:{pattern:/"(?:\\.|[^"\\])*"(?=\)$)/}}}}),Prism.languages.markdown.bold.inside.url=Prism.util.clone(Prism.languages.markdown.url),Prism.languages.markdown.italic.inside.url=Prism.util.clone(Prism.languages.markdown.url),Prism.languages.markdown.bold.inside.italic=Prism.util.clone(Prism.languages.markdown.italic),Prism.languages.markdown.italic.inside.bold=Prism.util.clone(Prism.languages.markdown.bold); // prettier-ignore

type MarkdownEditorProps = {
  doc: MarkdownDoc;
  changeDoc: (callback: (doc: MarkdownDoc) => void) => void;
};

export default function MarkdownEditor({
  doc,
  changeDoc,
}: MarkdownEditorProps) {
  const [selection, setSelection] = useState<Range | null>(null);
  console.log("rendering editor", doc.content.toString());

  // We model the document for Slate as a single text node.
  // It should stay a single node throughout all edits.
  const content: Node[] = [
    {
      children: [{ text: doc.content.toString() }],
    },
  ];

  const renderLeaf = (props: RenderLeafProps) => <Leaf {...props} />;

  const editor = useMemo(() => {
    return withOpHandler(
      withHistory(withReact(createEditor())),
      (op: Operation) => {
        console.log("applying Slate operation", op);
        if (op.type === "insert_text") {
          changeDoc((doc: MarkdownDoc) =>
            A.splice(doc, ["content"], op.offset, 0, op.text)
          );
        }
        if (op.type === "remove_text") {
          changeDoc((doc: MarkdownDoc) =>
            A.splice(doc, ["content"], op.offset, op.text.length)
          );
        }
      }
    );
  }, []);

  const decorate = useCallback(([node, path]) => {
    const ranges: Range[] = [];

    if (!Text.isText(node)) {
      return ranges;
    }

    const getLength = (token: any): number => {
      if (typeof token === "string") {
        return token.length;
      } else if (typeof token.content === "string") {
        return token.content.length;
      } else if (Array.isArray(token.content)) {
        return token.content.reduce((l, t) => l + getLength(t), 0);
      } else {
        return 0;
      }
    };

    // Add Markdown decorations
    console.log("tokenizing!");
    const tokens = Prism.tokenize(node.text, Prism.languages.markdown);
    let start = 0;

    for (const token of tokens) {
      const length = getLength(token);
      const end = start + length;

      if (typeof token !== "string") {
        ranges.push({
          [token.type]: true,
          anchor: { path, offset: start },
          focus: { path, offset: end },
        });
      }

      start = end;
    }

    return ranges;
  }, []);

  return (
    <div
      css={css`
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(750px, 70%) auto;
        grid-template-rows: 40px auto;
        grid-template-areas:
          "toolbar toolbar"
          "editor comments";
        column-gap: 10px;
      `}
    >
      <div
        css={css`
          grid-area: toolbar;
          padding: 5px;
          background: linear-gradient(to bottom, #fff, #eee);
          border-bottom: #ddd solid thin;
          box-sizing: border-box;
        `}
      >
        <div
          css={css`
            color: #333;
            font-weight: bold;
            font-size: 1rem;
            font-family: "Merriweather Sans";
          `}
        >
          <img
            src="assets/logo-favicon-310x310-transparent.png"
            height="30px"
            css={css`
              display: inline;
              vertical-align: top;
            `}
          />
          <div
            css={css`
              display: inline-block;
              padding-top: 3px;
            `}
          >
            Essay Editor
          </div>
        </div>
      </div>
      <div
        css={css`
          border-right: solid thin #eee;
          grid-area: editor;
          overflow: hidden;
          font-family: "Merriweather", serif;
          font-size: 16px;
          line-height: 24px;
          text-align: justify;
        `}
      >
        <Slate editor={editor} value={content} onChange={() => {}}>
          <Editable
            decorate={decorate}
            renderLeaf={renderLeaf}
            placeholder="Write some markdown here!"
            onSelect={() => {
              setSelection(editor.selection);
            }}
            style={{
              height: "100%",
              overflowY: "scroll",
              outline: "none",
              padding: "20px 50px",
              boxSizing: "border-box",
              overflowX: "hidden",
            }}
            // We want to keep the whole doc as one giant node;
            // block Enter key from creating a new node here.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                editor.insertText("\n");
              }
            }}
          />
        </Slate>
      </div>
    </div>
  );
}

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  return (
    <span
      {...attributes}
      css={css`
        font-weight: ${leaf.bold && "bold"};
        font-style: ${leaf.italic && "italic"};
        text-decoration: ${leaf.underlined && "underline"};
        ${leaf.title &&
        css`
          display: inline-block;
          font-weight: bold;
          font-size: 20px;
          margin: 20px 0 10px 0;
        `}
        ${leaf.list &&
        css`
          padding-left: 10px;
          font-size: 20px;
          line-height: 10px;
        `}
        ${leaf.hr &&
        css`
          display: block;
          text-align: center;
          border-bottom: 2px solid #ddd;
        `}
        ${leaf.blockquote &&
        css`
          display: inline-block;
          border-left: 2px solid #ddd;
          padding-left: 10px;
          color: #aaa;
          font-style: italic;
        `}
        ${leaf.code &&
        css`
          font-family: monospace;
          background-color: #eee;
          padding: 3px;
        `}
        ${leaf.highlighted &&
        css`
          background-color: #fffabe;
          color: black;
        `}
        ${leaf.extraHighlighted &&
        css`
          background-color: #ffeb00;
          color: black;
        `}
      `}
    >
      {children}
    </span>
  );
};
