import { syntaxTree } from "@codemirror/language";
import { EditorView, ViewPlugin } from "@codemirror/view";

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
    links: Link[] = [];

    constructor(view: EditorView) {
      this.links = getLinks(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.links = getLinks(update.view);
      }
    }

    getLinkAtPos(pos: number): Link | undefined {
      return this.links.find((l) => l.from < pos && l.to >= pos);
    }
  },
  {
    eventHandlers: {
      mousedown(event, view) {
        if (event.metaKey || event.ctrlKey) {
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });

          const link = this.getLinkAtPos(pos);

          event.stopPropagation();
          event.preventDefault();

          if (link) {
            if (event.shiftKey) {
              window.open(link.url, "_tab");
            } else {
              window.location.href = link.url;
            }
          }
        }
      },
    },
  }
);
