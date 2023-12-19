import {
  WidgetType,
  MatchDecorator,
  Decoration,
  ViewPlugin,
  DecorationSet,
  EditorView,
  ViewUpdate,
} from "@codemirror/view";

class LinkWidget extends WidgetType {
  constructor(protected url: string) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("a");
    wrap.href = this.url;
    wrap.target = "_blank";
    wrap.rel = "noopener noreferrer";
    wrap.className = "text-blue-500 underline";
    wrap.append(document.createTextNode(this.url));
    return wrap;
  }

  eq(other: LinkWidget) {
    return other.url === this.url;
  }

  ignoreEvent() {
    return true;
  }
}

const linkMatcher = new MatchDecorator({
  regexp: /(http|https):\/\/[^\s]+/g,
  decoration: (match) => {
    return Decoration.replace({
      widget: new LinkWidget(match[0]),
    });
  },
});

export const linkMatcherPlugin = ViewPlugin.fromClass(
  class {
    links: DecorationSet;
    constructor(view: EditorView) {
      this.links = linkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.links = linkMatcher.updateDeco(update, this.links);
    }
  },
  {
    decorations: (instance) => instance.links,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.links || Decoration.none;
      }),
  }
);
