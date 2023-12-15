import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { AuthProvider } from "@localfirst//auth-provider-automerge-repo";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";
import { storage } from "./storage";

import type { MarkdownDoc } from "./schema.js";
import { mount } from "./mount.js";
import "./index.css";

const repo = new Repo({
  network: [],
  storage,
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

mount(document.getElementById("root"), { docUrl });
