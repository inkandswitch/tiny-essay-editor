import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import type { MarkdownDoc } from "./schema.js";
import { mount } from "./mount.js";
import "./index.css";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
});

const rootDocUrl = `${document.location.hash.substr(1)}`;
let handle;
if (isValidAutomergeUrl(rootDocUrl)) {
  handle = repo.find(rootDocUrl);
} else {
  handle = repo.create<MarkdownDoc>();
  const { init } = await import("./init.js");
  handle.change(init);
}

// eslint-disable-next-line
const docUrl = (document.location.hash = handle.url);

// @ts-expect-error - adding property to window
window.Automerge = Automerge;
// @ts-expect-error - adding property to window
window.repo = repo;
// @ts-expect-error - adding property to window
window.handle = handle; // we'll use this later for experimentation

// @ts-expect-error - adding property to window
window.logoImageUrl = "/assets/logo-favicon-310x310-transparent.png";

// GL 12/6/23: Sometimes we need to wait a bit before navigating to a new doc,
// e.g. when making a fork the repo seems to not be ready if we go immediately.
// investigate this and remove the timeout.
// @ts-expect-error - set a window global
window.openDocumentInNewTab = (docUrl) => {
  setTimeout(
    () =>
      window.open(
        `${document.location.origin}${document.location.pathname}#${docUrl}`,
        "_blank"
      ),
    500
  );
};

mount(document.getElementById("root"), { docUrl });
