import { jsxToHtmlElement } from "@/datatypes/markdown/utils";
import { syntaxTree } from "@codemirror/language";
import { EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import { ExternalLink } from "lucide-react";

class HyperLink extends WidgetType {
  constructor(readonly url: string) {
    super();
  }
  eq(other) {
    return false;
  }
  toDOM() {
    return jsxToHtmlElement(
      <a
        href={this.url}
        aria-hidden
        target="_blank"
        className="ml-1"
        style={{ background: "none" }}
      >
        <ExternalLink className="inline mt-[-4px]" size={20} />
      </a>
    );
  }
}

type Link = {
  url: string;
  from: number;
  to: number;
};

const URL_REGEX = /\[(?<url>[^\[]*)\]/;

function getLinks(view: EditorView): Link[] {
  const links: Link[] = [];

  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        console.log(node.name);

        if (node.name === "Link") {
          const link = view.state.sliceDoc(node.from, node.to);
          const url = link.match(URL_REGEX).groups.url;

          links.push({
            from: node.from,
            to: node.to,
            url,
          });
        }
      },
    });
  }

  return links;
}

export const clickableMarkdownLinksPlugin = ViewPlugin.fromClass(
  class {
    links: Link[];

    constructor(view: EditorView) {
      this.links = getLinks(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.links = getLinks(update.view);
      }
    }
  },
  {
    eventHandlers: {
      pointerup(e, view) {
        const cursorPosition = view.state.selection.main?.head;

        if ((!e.ctrlKey && !e.metaKey) || cursorPosition === undefined) {
          return;
        }

        const link = this.links.find(
          (l) => l.from < cursorPosition && l.to >= cursorPosition
        );

        if (!link) {
          return;
        }

        if (e.shiftKey) {
          e.stopPropagation();
          e.preventDefault();
          view.dispatch({
            selection: { anchor: cursorPosition, head: cursorPosition },
          });
          window.open(link.url, "_tab");
        } else {
          window.location.href = link.url;
        }
      },
    },
  }
);
