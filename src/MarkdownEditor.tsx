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
import { getRelativeTimeString } from "./utils";
import { giveFeedback } from "./llm";

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

type LLMStatus = "idle" | "running" | "complete" | "error";

export default function MarkdownEditor({
  doc,
  changeDoc,
}: MarkdownEditorProps) {
  const [selection, setSelection] = useState<Range | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("idle");
  const [activeThread, setActiveThread] = useState<string | null>(null);

  const content = doc.content.toString();
  const marks = A.marks(doc, ["content"]);
  const commentsToShow = Object.values(doc.commentThreads)
    .filter(
      (thread) =>
        !thread.resolved &&
        marks.find((m) => m.name === `commentThread-${thread.id}`)
    )
    .map((thread) => {
      const mark = marks.find((m) => m.name === `commentThread-${thread.id}`);

      if (!mark) {
        console.error("no mark for thread!?", thread, marks);
      }

      const { start, end } = mark;
      console.log("mark", mark, start, end);

      return {
        ...thread,
        start,
        end,
      };
    });

  // console.log({ marks, commentsToShow });

  // We model the document for Slate as a single text node.
  // It should stay a single node throughout all edits.
  const slateNodes: Node[] = [
    {
      children: [{ text: content }],
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

  // TODO: this was in a usecallback originally but that caused a memoizing bug;
  // figure out how to cache this fn without caching mark start/end ranges
  const decorate = ([node, path]) => {
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

    // highlight comments

    for (const thread of commentsToShow) {
      if (activeThread === thread.id) {
        ranges.push({
          anchor: {
            path: [0, 0],
            offset: thread.start,
          },
          focus: {
            path: [0, 0],
            offset: thread.end,
          },
          extraHighlighted: true,
        });
      } else {
        ranges.push({
          anchor: {
            path: [0, 0],
            offset: thread.start,
          },
          focus: {
            path: [0, 0],
            offset: thread.end,
          },
          highlighted: true,
        });
      }
    }

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

    console.log("ranges", ranges);
    return ranges;
  };

  const addThreadForSelection = () => {
    let start = selection.anchor.offset;
    let end = selection.focus.offset;
    if (start > end) {
      [start, end] = [end, start];
    }

    const message = window.prompt("enter your comment text");
    const user = "geoffrey";

    addCommentThread({ start, end, message, user });
  };

  const addCommentThread = ({
    start,
    end,
    message,
    user,
  }: {
    start: number;
    end: number;
    message: string;
    user: string;
  }) => {
    const threadId = uuid();

    changeDoc((d) => {
      d.commentThreads[threadId] = {
        id: threadId,
        comments: [
          {
            id: uuid(),
            content: message,
            user,
            timestamp: Date.now(),
          },
        ],
        resolved: false,
      };

      A.mark(
        d,
        ["content"],
        { start, end, expand: "none" },
        `commentThread-${threadId}`,
        true
      );
    });
  };

  const getLLMFeedback = async () => {
    setLlmStatus("running");
    const feedback = await giveFeedback(content);
    console.log("feedback", feedback);

    if (feedback._type === "error") {
      setLlmStatus("error");
      return;
    }

    setLlmStatus("complete");
    const comments = feedback.result;
    for (const comment of comments) {
      const index = content.indexOf(comment.text);
      let start = 1;
      let end = 2;
      if (index !== -1) {
        start = index;
        end = start + comment.text.length;
      } else {
        console.warn(`Couldn't find this text in the doc: ${comment.text}`);
      }

      addCommentThread({
        start,
        end,
        message: `${comment.comment} (${comment.styleGuideItem})`,
        user: "🤖 Academish Voice Check",
      });
    }
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
        <Slate editor={editor} value={slateNodes} onChange={() => {}}>
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
          overflow-y: scroll;
        `}
      >
        <div
          css={css`
            display: flex;
            flex-direction: row;
            gap: 10px;
          `}
        >
          <div>
            <button onClick={addThreadForSelection}>Add comment thread</button>{" "}
          </div>
          <div>
            <button onClick={getLLMFeedback}>Academish Voice Check</button>
            {llmStatus === "running" && (
              <div
                css={css`
                  color: #333;
                  font-size: 12px;
                  animation: pulse 2s infinite;
                  @keyframes pulse {
                    0% {
                      opacity: 1;
                    }
                    50% {
                      opacity: 0.5;
                    }
                    100% {
                      opacity: 1;
                    }
                  }
                `}
              >
                Checking...
              </div>
            )}
          </div>
        </div>

        {sortBy(commentsToShow, (t) => t.start).map((thread) => (
          <div
            key={thread.id}
            onClick={() => {
              if (activeThread === thread.id) {
                setActiveThread(null);
              } else {
                setActiveThread(thread.id);
              }
            }}
            css={css`
              margin: 10px 0;
              border: ${activeThread === thread.id ? "solid 2px #ddd" : "none"};
            `}
          >
            {thread.comments.map((comment) => (
              <div
                key={comment.id}
                css={css`
                  background-color: #f2f2f2;
                  padding: 10px;
                  max-width: 300px;
                `}
              >
                <div
                  css={css`
                    font-size: 14px;
                    font-weight: 400;
                  `}
                >
                  <div
                    css={css`
                      margin-bottom: 12px;
                    `}
                  >
                    {comment.content}
                  </div>
                  <div
                    css={css`
                      font-size: 12px;
                      text-align: right;
                    `}
                  >
                    <span
                      css={css`
                        color: #444;
                      `}
                    >
                      {comment.user}
                    </span>{" "}
                    <span
                      css={css`
                        color: #888;
                      `}
                    >
                      {getRelativeTimeString(comment.timestamp)}
                    </span>
                  </div>
                  <div
                    css={css`
                      text-align: right;
                    `}
                  >
                    <a
                      css={css`
                        font-size: 12px;
                        cursor: pointer;
                        opacity: 0.5;
                        &:hover {
                          opacity: 1;
                        }
                      `}
                      onClick={() => {
                        changeDoc((d) => {
                          d.commentThreads[thread.id].resolved = true;
                        });
                      }}
                    >
                      Resolve this comment
                    </a>
                  </div>
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
