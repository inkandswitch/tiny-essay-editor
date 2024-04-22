import {
  WidgetType,
  EditorView,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

class Image extends WidgetType {
  constructor(protected url: string, protected caption: string) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("div");
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.src = this.url;

    wrap.append(image);
    wrap.className = "border border-gray-200 w-fit";

    if (this.caption.length > 0) {
      const captionDiv = document.createElement("div");
      captionDiv.append(document.createTextNode(this.caption));
      captionDiv.className = "p-4 bg-gray-100 text-sm font-sans";
      wrap.append(captionDiv);
    }

    return wrap;
  }

  eq(other: Image) {
    return other.url === this.url && other.caption === this.caption;
  }

  ignoreEvent() {
    return true;
  }
}

const MARKDOWN_IMAGE_REGEX = /!\[(?<caption>.*?)\]\((?<url>.*?)\)/gs;

function getImages(view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    while ((match = MARKDOWN_IMAGE_REGEX.exec(text))) {
      const position = match.index + from;

      const url = match.groups.url;
      const caption = match.groups.caption;
      const widget = Decoration.widget({
        widget: new Image(url, caption),
        side: -1,
      }).range(position);
      decorations.push(widget);
      decorations.push(
        Decoration.mark({
          class:
            "text-gray-500 font-mono text-left text-sm leading-snug inline-block opacity-70 mb-1",
        }).range(position, position + match[0].length)
      );
    }
  }

  return Decoration.set(
    decorations.sort((range1, range2) => range1.from - range2.from)
  );
}

export const previewImagesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getImages(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = getImages(update.view);
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
