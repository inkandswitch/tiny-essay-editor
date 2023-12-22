import { Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import "./index.css";
import { mount } from "./mount.js";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
});

// @ts-expect-error - adding property to window
window.Automerge = Automerge;
// @ts-expect-error - adding property to window
window.repo = repo;

// Unlike other uses of mount, here we don't pass any doc URL.
// That's because DocExplorer internally expects to manage the URL hash itself.

mount(document.getElementById("root"), {});
