import {
  WidgetType,
  EditorView,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";

// We assume any relative links are trying to load assets for the Embark essay.
// This is just a hack to make the Embark editing experience work.
// In general, using absolute links for assets is better.
const EMBARK_ASSET_URL = "https://www.inkandswitch.com/essay-embark";

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

    if (this.url.startsWith("http://") || this.url.startsWith("https://")) {
      image.src = this.url;
    } else {
      image.crossOrigin = "anonymous";
      image.src = `${EMBARK_ASSET_URL}/${this.url}`;
    }

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
    video.width = 320;
    video.height = 240;
    video.controls = true;

    const source = document.createElement("source");
    if (this.url.startsWith("http://") || this.url.startsWith("https://")) {
      source.src = this.url;
    } else {
      source.src = `${EMBARK_ASSET_URL}/${this.url}`;
      video.crossOrigin = "anonymous";
    }
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
        const widget = Decoration.widget({
          widget: new VideoFigure(src, caption),
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

export const previewFiguresPlugin = ViewPlugin.fromClass(
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
