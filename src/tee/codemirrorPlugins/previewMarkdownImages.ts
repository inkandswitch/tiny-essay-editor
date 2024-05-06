import {
  WidgetType,
  EditorView,
  ViewPlugin,
  DecorationSet,
  ViewUpdate,
  Decoration,
} from "@codemirror/view";
import { Range, StateEffect, StateField } from "@codemirror/state";
import {
  AutomergeUrl,
  DocHandle,
  DocHandleChangePayload,
  DocHandleRemoteHeadsPayload,
  DocumentId,
  Repo,
} from "@automerge/automerge-repo";
import { MarkdownDoc } from "../schema";
import { AssetsDoc } from "../assets";
import * as A from "@automerge/automerge";

class Image extends WidgetType {
  constructor(
    protected heads: A.Heads[],
    protected url: string,
    protected caption: string
  ) {
    super();
  }

  toDOM() {
    const wrapper = document.createElement("div");
    const image = document.createElement("img");

    image.crossOrigin = "anonymous";
    image.src = this.url;
    image.className = "min-w-0";
    image.onerror = () => {
      image.style.opacity = "0";
    };

    wrapper.append(image);
    wrapper.className = "w-fit border border-gray-200";

    if (this.caption.length > 0) {
      const captionDiv = document.createElement("div");
      captionDiv.append(document.createTextNode(this.caption));
      captionDiv.className = "p-4 bg-gray-100 text-sm font-sans";
      wrapper.append(captionDiv);
    }

    return wrapper;
  }

  eq(other: Image) {
    return (
      other.url === this.url &&
      other.caption === this.caption &&
      A.equals(other.heads, this.heads)
    );
  }

  ignoreEvent() {
    return true;
  }
}

const MARKDOWN_IMAGE_REGEX = /!\[(?<caption>.*?)\]\((?<url>.*?)\)/gs;

function getImages(heads: A.Heads, assetsDocId: DocumentId, view: EditorView) {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);

    let match;
    while ((match = MARKDOWN_IMAGE_REGEX.exec(text))) {
      const position = match.index + from;

      const url = match.groups.url;
      const caption = match.groups.caption;
      const image = new Image(
        heads,
        assetsDocId && url.startsWith("./assets")
          ? `https://automerge/${assetsDocId}/files/${url.split("/")[2]}`
          : "",
        caption
      );
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

export const setAssetHeadsEffect = StateEffect.define<A.Heads>();
export const assetsHeadsField = StateField.define<A.Heads>({
  create() {
    return [];
  },
  update(threads, tr) {
    for (const e of tr.effects) {
      if (e.is(setAssetHeadsEffect)) {
        return e.value;
      }
    }
    return threads;
  },
});

export const previewImagesPlugin = (
  handle: DocHandle<MarkdownDoc>,
  repo: Repo
) => [
  assetsHeadsField,
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.set([]);
      images: HTMLImageElement[] = [];

      assetsDocHandle: DocHandle<AssetsDoc>;

      constructor(private view: EditorView) {
        this.decorations = getImages([], undefined, view);
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

        if (!url) {
          return;
        }

        this.assetsDocHandle = repo.find<AssetsDoc>(url);
        this.assetsDocHandle.on("remote-heads", this.onRemoteHeadsChanged);

        this.assetsDocHandle.whenReady().then(() => {
          const heads = A.getHeads(this.assetsDocHandle.docSync());
          this.view.dispatch({ effects: setAssetHeadsEffect.of(heads) });
        });
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
          this.view.dispatch({ effects: setAssetHeadsEffect.of(heads) });
        }
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.transactions.some((tr) =>
            tr.effects.some((e) => e.is(setAssetHeadsEffect))
          )
        ) {
          const heads = update.state.field(assetsHeadsField);
          this.decorations = getImages(
            heads,
            this.assetsDocHandle?.documentId,
            update.view
          );
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  ),
];
