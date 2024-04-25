import {
  WidgetType,
  EditorView,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range } from "@codemirror/state";
import {
  AutomergeUrl,
  DocHandle,
  DocHandleChangePayload,
  DocHandleRemoteHeadsPayload,
  Repo,
} from "@automerge/automerge-repo";
import { MarkdownDoc } from "../schema";
import { AssetsDoc } from "../assets";

class Image extends WidgetType {
  constructor(
    protected url: string,
    protected caption: string,
    protected registerImage: (image: HTMLImageElement) => void
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement("div");
    const image = document.createElement("img");

    this.registerImage(image);

    image.crossOrigin = "anonymous";
    image.src = this.url;

    wrapper.append(image);
    wrapper.className = "border border-gray-200 w-fit";

    if (this.caption.length > 0) {
      const captionDiv = document.createElement("div");
      captionDiv.append(document.createTextNode(this.caption));
      captionDiv.className = "p-4 bg-gray-100 text-sm font-sans";
      wrapper.append(captionDiv);
    }

    return wrapper;
  }

  eq(other: Image) {
    return other.url === this.url && other.caption === this.caption;
  }

  ignoreEvent() {
    return true;
  }
}

const MARKDOWN_IMAGE_REGEX = /!\[(?<caption>.*?)\]\((?<url>.*?)\)/gs;

function getImages(
  view: EditorView,
  registerImage: (image: HTMLImageElement) => void
) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    while ((match = MARKDOWN_IMAGE_REGEX.exec(text))) {
      const position = match.index + from;

      const url = match.groups.url;
      const caption = match.groups.caption;
      const image = new Image(url, caption, registerImage);
      const widget = Decoration.widget({
        widget: image,
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

  return Decoration.set(decorations, true /* = sort decorations */);
}

export const previewImagesPlugin = (
  handle: DocHandle<MarkdownDoc>,
  repo: Repo
) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      images: HTMLImageElement[] = [];

      assetsDocHandle: DocHandle<AssetsDoc>;

      constructor(view: EditorView) {
        this.decorations = getImages(view, (image) => {
          this.images.push(image);
        });

        this.onChangeDoc = this.onChangeDoc.bind(this);
        this.onRemoteHeadsChanged = this.onRemoteHeadsChanged.bind(this);

        if (handle.isReady()) {
          const assetsDocUrl = handle.docSync().assetsDocUrl;
          this.onChangeAssetsDocUrl(assetsDocUrl);
        }

        handle.on("change", this.onChangeDoc);
      }

      onChangeDoc({ doc }: DocHandleChangePayload<MarkdownDoc>) {
        if (
          this.assetsDocHandle &&
          this.assetsDocHandle.url === doc.assetsDocUrl
        ) {
          return;
        }

        if (this.assetsDocHandle) {
          this.assetsDocHandle.off("remote-heads", this.onRemoteHeadsChanged);
        }

        if (doc.assetsDocUrl) {
          this.onChangeAssetsDocUrl(doc.assetsDocUrl);
        }
      }

      onChangeAssetsDocUrl(url: AutomergeUrl) {
        if (this.assetsDocHandle) {
          this.assetsDocHandle.off("remote-heads", this.onRemoteHeadsChanged);
        }

        this.assetsDocHandle = repo.find<AssetsDoc>(url);
        this.assetsDocHandle.on("remote-heads", this.onRemoteHeadsChanged);
      }

      async onRemoteHeadsChanged({
        heads,
        storageId,
      }: DocHandleRemoteHeadsPayload) {
        // We care about remote heads event from the service worker, because we can only load
        // assets once they have arrived in the service worker. The service worker and the
        // client have the same storage id since they are connected to the same indexeddb instance.
        const ownStorageId = await repo.storageId();
        if (ownStorageId === storageId) {
          this.images.forEach((image) => {
            const url = image.src;
            image.src = "";
            image.src = url;
          });
        }
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.images = [];
          this.decorations = getImages(update.view, (image) =>
            this.images.push(image)
          );
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
