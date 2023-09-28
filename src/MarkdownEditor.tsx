/** @jsx jsx */
/* @jsxFrag React.Fragment */

import { useCallback, useMemo, useState } from "react";
import { css } from "@emotion/react";

import { createEditor, Text, Range, Node, Operation, Editor } from "slate";
import { withHistory } from "slate-history";
import { next as A, uuid } from "@automerge/automerge";
import { sortBy } from "lodash";
import {
  Editable,
  ReactEditor,
  RenderLeafProps,
  Slate,
  withReact,
} from "slate-react";
import Prism from "prismjs";
import { MarkdownDoc } from "./schema";

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

  const marks = A.marks(doc, ["content"]);
  console.log(marks);
  const commentsToShow = Object.values(doc.commentThreads)
    .filter((thread) => !thread.resolved)
    .map((thread) => {
      const mark = marks.find((m) => m.name === `commentThread-${thread.id}`);

      if (!mark) {
        console.error("no mark for thread!?", thread);
      }

      const { start, end } = mark;

      return {
        ...thread,
        start,
        end,
      };
    });

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
        switch (op.type) {
          case "insert_text": {
            changeDoc((doc: MarkdownDoc) =>
              A.splice(doc, ["content"], op.offset, 0, op.text)
            );
            break;
          }
          case "remove_text": {
            changeDoc((doc: MarkdownDoc) =>
              A.splice(doc, ["content"], op.offset, op.text.length)
            );
            break;
          }
          case "split_node":
          case "insert_node":
          case "merge_node": {
            throw new Error(
              "we never want to see these ops that split nodes up"
            );
          }
        }
      }
    ) as ReactEditor;
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
    const before = performance.now();
    const tokens = Prism.tokenize(node.text, Prism.languages.markdown);
    const after = performance.now();
    console.log(`Prism.tokenize took ${Math.round(after - before)}ms`);
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

  const addCommentThread = () => {
    console.log("adding a comment");
    const threadId = uuid();

    changeDoc((d) => {
      d.commentThreads[threadId] = {
        id: threadId,
        comments: [
          {
            id: uuid(),
            content: "this is a comment",
            user: "geoffrey",
            timestamp: Date.now(),
          },
        ],
        resolved: false,
      };

      A.mark(
        d,
        ["content"],
        { start: 1, end: 5, expand: "none" },
        `commentThread-${threadId}`,
        true
      );
    });
  };

  return (
    <div
      css={css`
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: min(776px, 80%) auto;
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
              padding-top: 5px;
              font-weight: bold;
              color: #444;
            `}
          >
            Tiny Essay Editor
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
            onPaste={(event) => {
              // Slate does weird fancy things when plaintext is pasted.
              // Just keep it simple and insert text.
              event.preventDefault();
              editor.insertText(event.clipboardData.getData("text/plain"));
            }}
            style={{
              height: "100%",
              overflowY: "scroll",
              outline: "none",
              padding: "20px 80px",
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
      <div
        css={css`
          grid-area: comments;
          padding: 5px;
        `}
      >
        <button onClick={addCommentThread}>Add comment thread</button>
        {sortBy(commentsToShow, (t) => t.start).map((thread) => (
          <div key={thread.id}>
            {thread.comments.map((comment) => (
              <div key={comment.id}>
                <div>
                  {comment.content} (by {comment.user})
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  let headingSize = 16;
  if (leaf.title) {
    if (leaf.text.startsWith("# ")) {
      headingSize = 32;
    }
    if (leaf.text.startsWith("## ")) {
      headingSize = 24;
    }
    if (leaf.text.startsWith("### ")) {
      headingSize = 20;
    }
    if (leaf.text.startsWith("#### ")) {
      headingSize = 18;
    }
  }

  return (
    <span
      {...attributes}
      css={css`
        font-weight: ${leaf.bold && "bold"};
        font-style: ${leaf.italic && "italic"};
        text-decoration: ${leaf.underlined && "underline"};
        ${leaf.text === "<!--endintro-->" &&
        css`
          color: #ddd;
        `}
        ${leaf.title &&
        css`
          display: inline-block;
          font-size: ${headingSize}px;
          font-weight: 400;
          font-family: "Merriweather Sans", sans-serif;
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
