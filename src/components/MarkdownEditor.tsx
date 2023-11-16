import React, { useCallback, useEffect, useRef } from "react";

import {
  EditorView,
  Decoration,
  ViewPlugin,
  WidgetType,
  DecorationSet,
  ViewUpdate,
  keymap,
} from "@codemirror/view";
import { StateEffect, StateField, Range, EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
// import {javascript} from "@codemirror/lang-javascript"
import {
  syntaxHighlighting,
  HighlightStyle,
  ensureSyntaxTree,
  indentUnit,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Prop } from "@automerge/automerge";
import {
  plugin as amgPlugin,
  PatchSemaphore,
} from "@automerge/automerge-codemirror";
import { indentWithTab } from "@codemirror/commands";
import { type DocHandle } from "@automerge/automerge-repo";
import { CommentThreadForUI, MarkdownDoc } from "../schema";
import { amRangeToCMRange, getThreadsForUI, jsxToHtmlElement } from "@/utils";
import { isEqual, sortBy } from "lodash";
import { Tree } from "@lezer/common";

export type TextSelection = {
  from: number;
  to: number;
  yCoord: number;
};

export type EditorProps = {
  handle: DocHandle<MarkdownDoc>;
  path: Prop[];
  setSelection: (selection: TextSelection) => void;
  setView: (view: EditorView) => void;
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
};

const setThreadsEffect = StateEffect.define<CommentThreadForUI[]>();
const threadsField = StateField.define<CommentThreadForUI[]>({
  create() {
    return [];
  },
  update(threads, tr) {
    for (const e of tr.effects) {
      if (e.is(setThreadsEffect)) {
        return e.value;
      }
    }
    return threads;
  },
});

const threadDecoration = Decoration.mark({ class: "cm-comment-thread" });
const activeThreadDecoration = Decoration.mark({
  class: "cm-comment-thread active",
});

const threadDecorations = EditorView.decorations.compute(
  [threadsField],
  (state) => {
    const commentThreads = state.field(threadsField);

    const decorations =
      sortBy(commentThreads ?? [], (thread) => thread.from)?.flatMap(
        (thread) => {
          const cmRange = amRangeToCMRange(thread);
          if (thread.to > thread.from) {
            if (thread.active) {
              return activeThreadDecoration.range(cmRange.from, cmRange.to);
            } else {
              return threadDecoration.range(cmRange.from, cmRange.to);
            }
          } else {
            return [];
          }
        }
      ) ?? [];

    return Decoration.set(decorations);
  }
);

const theme = EditorView.theme({
  "&": {},
  "&.cm-editor.cm-focused": {
    outline: "none",
  },
  "&.cm-editor": {
    height: "100%",
  },
  ".cm-scroller": {
    height: "100%",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-content": {
    height: "100%",
    fontFamily: '"Merriweather", serif',
    padding: "10px 0",
    margin: "0 var(--cm-padding-x)",
    color: "var(--text-color)",
    caretColor: "var(--text-color)",
    textAlign: "justify",
    lineHeight: "24px",
  },
  ".cm-content li": {
    marginBottom: 0,
  },
  ".cm-activeLine": {
    backgroundColor: "inherit",
  },
  ".cm-comment-thread": {
    backgroundColor: "var(--highlight-color)",
  },
  ".cm-comment-thread.active": {
    backgroundColor: "var(--highlight-active-color)",
  },
  // active highlighting wins if it's inside another thread
  ".cm-comment-thread.active .cm-comment-thread": {
    backgroundColor: "var(--highlight-active-color)",
  },
  ".frontmatter": {
    fontFamily: "monospace",
    color: "#666",
    textDecoration: "none",
    fontWeight: "normal",
    lineHeight: "0.8em",
  },
});

const baseHeadingStyles = {
  fontFamily: '"Merriweather Sans", sans-serif',
  fontWeight: 400,
  textDecoration: "none",
};

const baseCodeStyles = {
  fontFamily: "monospace",
  fontSize: "14px",
};

const markdownStyles = HighlightStyle.define([
  {
    tag: tags.heading1,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading2,
    ...baseHeadingStyles,
    fontSize: "1.5rem",
    lineHeight: "2rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading3,
    ...baseHeadingStyles,
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.heading4,
    ...baseHeadingStyles,
    fontSize: "1.1rem",
    marginBottom: "1rem",
    marginTop: "2rem",
  },
  {
    tag: tags.comment,
    color: "#555",
    fontFamily: "monospace",
  },
  {
    tag: tags.strong,
    fontWeight: "bold",
  },
  {
    tag: tags.emphasis,
    fontStyle: "italic",
  },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
  },
  {
    tag: [tags.meta],
    fontWeight: 300,
    color: "#888",
    fontFamily: '"Merriweather Sans", sans-serif',
  },
  { tag: tags.keyword, ...baseCodeStyles, color: "#708" },
  {
    tag: [
      tags.atom,
      tags.bool,
      tags.url,
      tags.contentSeparator,
      tags.labelName,
    ],
    ...baseCodeStyles,
    color: "#219",
  },
  { tag: [tags.literal, tags.inserted], ...baseCodeStyles, color: "#164" },
  { tag: [tags.string, tags.deleted], ...baseCodeStyles, color: "#5f67b5" },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    ...baseCodeStyles,
    color: "#e40",
  },
  { tag: tags.definition(tags.variableName), ...baseCodeStyles, color: "#00f" },
  { tag: tags.local(tags.variableName), ...baseCodeStyles, color: "#30a" },
  { tag: [tags.typeName, tags.namespace], ...baseCodeStyles, color: "#085" },
  { tag: tags.className, ...baseCodeStyles, color: "#167" },
  {
    tag: [tags.special(tags.variableName), tags.macroName],
    ...baseCodeStyles,
    color: "#256",
  },
  { tag: tags.definition(tags.propertyName), ...baseCodeStyles, color: "#00c" },
]);

export function MarkdownEditor({
  handle,
  path,
  setSelection,
  setView,
  activeThreadId,
  setActiveThreadId,
}: EditorProps) {
  const containerRef = useRef(null);
  const editorRoot = useRef<EditorView>(null);
  const [editorCrashed, setEditorCrashed] = React.useState<boolean>(false);

  const getThreadsForDecorations = useCallback(
    () => getThreadsForUI(handle.docSync(), editorRoot.current, activeThreadId),
    [activeThreadId, handle]
  );

  // Propagate activeThreadId into the codemirror
  useEffect(() => {
    editorRoot.current?.dispatch({
      effects: setThreadsEffect.of(getThreadsForDecorations()),
    });
  }, [activeThreadId, getThreadsForDecorations]);

  useEffect(() => {
    const doc = handle.docSync();
    const source = doc.content; // this should use path
    const plugin = amgPlugin(doc, path);
    const semaphore = new PatchSemaphore(plugin);
    const view = new EditorView({
      doc: source,
      extensions: [
        basicSetup,
        plugin,
        EditorView.lineWrapping,
        theme,
        markdown({
          codeLanguages: languages,
        }),
        keymap.of([indentWithTab]),
        indentUnit.of("    "),
        syntaxHighlighting(markdownStyles),
        frontmatterPlugin,
        threadsField,
        threadDecorations,
        previewFiguresPlugin,
        highlightKeywordsPlugin,
        tableOfContentsPreviewPlugin,
        codeMonospacePlugin,
      ],
      dispatch(transaction) {
        // TODO: can some of these dispatch handlers be factored out into plugins?
        try {
          const newSelection = transaction.newSelection.ranges[0];
          if (transaction.newSelection !== view.state.selection) {
            // set the active thread id if our selection is in a thread
            for (const thread of getThreadsForDecorations()) {
              if (
                thread.from <= newSelection.from &&
                thread.to >= newSelection.to
              ) {
                setActiveThreadId(thread.id);
                break;
              }
              setActiveThreadId(null);
            }
          }
          view.update([transaction]);
          semaphore.reconcile(handle, view);
          const selection = view.state.selection.ranges[0];
          setSelection({
            from: selection.from,
            to: selection.to,
            yCoord:
              -1 * view.scrollDOM.getBoundingClientRect().top +
              view.coordsAtPos(selection.from).top,
          });
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

    view.dispatch({
      effects: setThreadsEffect.of(getThreadsForDecorations()),
    });

    const handleChange = () => {
      semaphore.reconcile(handle, view);

      // TODO: is this the right place to update the threads field? not sure.
      view.dispatch({
        effects: setThreadsEffect.of(getThreadsForDecorations()),
      });
    };

    handle.addListener("change", handleChange);

    return () => {
      handle.removeListener("change", handleChange);
      view.destroy();
    };
  }, []);

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
          evt.stopPropagation();
        }}
      />
    </div>
  );
}

// todo: currently hard coded for embark essay, assumes hugo is running on default port
const BASE_URL = "https://www.inkandswitch.com/essay-embark";

class Figure extends WidgetType {
  constructor(protected url: string, protected caption: string) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    return undefined;
  }

  eq(other: Figure) {
    return other.url === this.url && other.caption === this.caption;
  }

  ignoreEvent() {
    return true;
  }
}

class ImageFigure extends Figure {
  toDOM() {
    const wrap = document.createElement("div");
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.src = `${BASE_URL}/${this.url}`;

    wrap.append(image);
    wrap.className = "border border-gray-200 mb-4";

    const captionDiv = document.createElement("div");
    captionDiv.append(document.createTextNode(this.caption));
    captionDiv.className = "p-4 bg-gray-100 text-sm font-sans";
    wrap.append(captionDiv);

    return wrap;
  }
}

class VideoFigure extends Figure {
  toDOM() {
    const wrap = document.createElement("div");
    const video = document.createElement("video");
    video.className = "w-full";
    video.crossOrigin = "anonymous";
    video.width = 320;
    video.height = 240;
    video.controls = true;

    const source = document.createElement("source");
    source.src = `${BASE_URL}/${this.url}`;
    source.type = "video/mp4";

    const captionDiv = document.createElement("div");
    captionDiv.append(document.createTextNode(this.caption));
    captionDiv.className = "p-4 bg-gray-100 text-sm font-sans";

    video.appendChild(source);
    wrap.appendChild(video);
    wrap.append(captionDiv);

    wrap.className = "border border-gray-200 mb-4";
    return wrap;
  }
}

const previewFiguresPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getFigures(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getFigures(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const SOURCE_ATTR_REGEX = /src="(?<value>.*?)" caption="(?<caption>.*?)"/;
const BLOCK_EXPR_REGEX = /(\{\{< rawhtml >}}(?<source>.*?){{< \/rawhtml >}})/gs;
const INLINE_EXPR_REGEX = /({{(?<source>.*?)}})/gs;

function getFigures(view: EditorView) {
  const decorations: Range<Decoration>[] = [];
  const parser = new DOMParser();

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = INLINE_EXPR_REGEX.exec(text))) {
      const position = match.index + from;

      const srcAttrMatch = match.groups.source.match(SOURCE_ATTR_REGEX);
      if (srcAttrMatch) {
        const url = srcAttrMatch.groups.value;
        const caption = srcAttrMatch.groups.caption;
        const widget = Decoration.widget({
          widget: new ImageFigure(url, caption),
          side: 1,
        }).range(position);
        decorations.push(widget);
        decorations.push(
          Decoration.mark({
            class:
              "text-gray-400 font-mono text-left text-sm leading-snug inline-block opacity-60",
          }).range(position, position + match[0].length)
        );
      }
    }

    // eslint-disable-next-line no-cond-assign
    while ((match = BLOCK_EXPR_REGEX.exec(text))) {
      const position = match.index + from;
      const doc = parser.parseFromString(match.groups.source, "text/html");
      const src = doc.body.getElementsByTagName("video")[0]?.src;
      const caption =
        doc.body.getElementsByTagName("figcaption")[0]?.innerText?.trim() ?? "";

      if (src) {
        const url = new URL(src).pathname.slice(1);
        const widget = Decoration.widget({
          widget: new VideoFigure(url, caption),
          side: 1,
        }).range(position);
        decorations.push(widget);
        decorations.push(
          Decoration.mark({
            class:
              "text-gray-400 font-mono text-left text-sm leading-snug inline-block opacity-60",
          }).range(position, position + match[0].length)
        );
      }
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

const highlightKeywordsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getHighlightWords(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getHighlightWords(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

// TODO: make these highlight words configurable in the app
const HIGHLIGHT_KEYWORDS_REGEX = /TODO|@Paul|@Geoffrey|@Alex/g;
function getHighlightWords(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = HIGHLIGHT_KEYWORDS_REGEX.exec(text))) {
      const position = match.index + from;
      decorations.push(
        Decoration.mark({
          class: "bg-red-200 p-1 rounded-sm",
        }).range(position, position + match[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

const frontmatterPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getFrontmatterDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getFrontmatterDecorations(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

const frontmatterRegex = /^---.*---/s;
function getFrontmatterDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    const frontmatterMatch = text.match(frontmatterRegex);

    if (frontmatterMatch) {
      const position = frontmatterMatch.index + from;
      decorations.push(
        Decoration.mark({
          class: "frontmatter",
        }).range(position, position + frontmatterMatch[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

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

const END_INTRO_REGEX = /<!--endintro-->/;
function getTOCDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    const tocMatch = text.match(END_INTRO_REGEX);

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

      let headingTree: HeadingTree = [];

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
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

const tableOfContentsPreviewPlugin = ViewPlugin.fromClass(
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

const CODE_BLOCK_REGEX = /```.*?```/gs;
function getCodeDecorations(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  const text = view.state.doc.sliceString(0);

  const codeBlockMatches = text.matchAll(CODE_BLOCK_REGEX);

  for (const match of codeBlockMatches) {
    const position = match.index;

    decorations.push(
      Decoration.mark({
        class: "font-mono text-sm text-left inline-block",
      }).range(position, position + match[0].length)
    );
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

const codeMonospacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getCodeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getCodeDecorations(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
