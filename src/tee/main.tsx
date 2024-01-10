import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import { mount } from "./mount.js";
import "./index.css";
import { MarkdownDoc } from "./schema.js";

const SYNC_SERVER_URL =
  import.meta.env?.VITE_SYNC_SERVER_URL ?? "wss://sync.automerge.org";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter(SYNC_SERVER_URL),
  ],
  storage: new IndexedDBStorageAdapter(),
});

const rootDocUrl = `${document.location.hash.slice(1)}`;
let handle;
if (isValidAutomergeUrl(rootDocUrl)) {
  handle = repo.find(rootDocUrl);
} else {
  handle = repo.create<MarkdownDoc>();
  const { init } = await import("./datatype.js");
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

mount(document.getElementById("root"), { docUrl });
