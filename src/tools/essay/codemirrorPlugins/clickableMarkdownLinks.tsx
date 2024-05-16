import { jsxToHtmlElement } from "@/datatypes/markdown/utils";
import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import { RangeSet } from "@uiw/react-codemirror";
import { ExternalLink } from "lucide-react";
import linkIcon from "../assets/linkIcon.svg";

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

const linkDecorator = new MatchDecorator({
  regexp: /\((?<name>[^\)]*)\)\[(?<url>[^\]]*)\]/g,
  decorate: (add, from, to, match, view) => {
    const url = match.groups.url;

    if (url == "") {
      return;
    }

    const start = to,
      end = to;
    const linkIcon = new HyperLink(url);
    add(
      start,
      end,
      Decoration.widget({ widget: linkIcon, block: false, side: 1 })
    );
  },
});

export const clickableMarkdownLinksPlugin = ViewPlugin.fromClass(
  class URLView {
    decorations: RangeSet<Decoration>;

    constructor(view) {
      this.decorations = linkDecorator.createDeco(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = linkDecorator.updateDeco(update, this.decorations);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
