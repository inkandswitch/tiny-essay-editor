import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

type Link = {
  url: string;
  from: number;
  to: number;
};

const URL_REGEX = /\[.*\]\((?<url>.*)\)/;

const setHoveredLinkEffect = StateEffect.define<Link | undefined>();

const hoveredLinkField = StateField.define<Link | undefined>({
  create: () => undefined,
  update(hoveredLink, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setHoveredLinkEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged && hoveredLink) {
      let mappedFrom = tr.changes.mapPos(hoveredLink.from);
      let mappedTo = tr.changes.mapPos(hoveredLink.to);

      return mappedFrom < mappedTo
        ? { ...hoveredLink, from: mappedFrom, to: mappedTo }
        : undefined;
    }
    return hoveredLink;
  },
});

export const hoveredLinkDecorations = EditorView.decorations.compute(
  [hoveredLinkField],
  (state) => {
    const hoveredLink = state.field(hoveredLinkField);

    if (!hoveredLink) {
      return Decoration.none;
    }

    return Decoration.set([
      Decoration.mark({
        class: "underline",
      }).range(hoveredLink.from, hoveredLink.to),
    ]);
  }
);

function getLinks(view: EditorView): Link[] {
  const links: Link[] = [];

  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "Link") {
          const link = view.state.sliceDoc(node.from, node.to);
          const url = link.match(URL_REGEX)?.groups?.url;

          if (!url) {
            return;
          }

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

export const clickableMarkdownLinksPlugin = [
  hoveredLinkField,
  hoveredLinkDecorations,
  ViewPlugin.fromClass(
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

            if (!link) {
              return;
            }

            window.open(link.url, "_tab");
          }
        },

        mousemove(event, view) {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          const link = this.getLinkAtPos(pos);

          // ensure that mouse actually points inside of link and not beside it
          const rect = view.coordsAtPos(pos - 1);
          const distance = Math.abs(rect.left - event.clientX);
          if (link && distance < 20) {
            if (view.state.field(hoveredLinkField) !== link) {
              view.dispatch({ effects: setHoveredLinkEffect.of(link) });
            }
          } else {
            if (view.state.field(hoveredLinkField)) {
              view.dispatch({ effects: setHoveredLinkEffect.of(undefined) });
            }
          }
        },
        mouseleave(event, view) {
          view.dispatch({ effects: setHoveredLinkEffect.of(undefined) });
        },
      },
    }
  ),
];
