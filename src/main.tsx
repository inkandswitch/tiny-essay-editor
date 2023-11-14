import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import App from "./components/App";
import type { MarkdownDoc } from "./schema.ts";
import { mount } from "./mount.ts"
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
  const { init } = await import("./init.ts")
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

mount(document.getElementById("root"), { docUrl })
