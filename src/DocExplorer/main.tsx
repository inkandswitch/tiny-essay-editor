import { Repo, AutomergeUrl } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge, diffWithAttribution } from "@automerge/automerge";

import * as aw from "@automerge/automerge-wasm";

console.log(aw);

import "./index.css";
import { mount } from "./mount.js";
import { getAccount } from "./account.js";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
  changeMetadata: () => ({ author, time: Date.now() }),
});

let author: AutomergeUrl;

getAccount(repo).then((account) => {
  author = account.contactHandle.url;

  account.on("change", () => {
    author = account.contactHandle.url;
  });
});

// @ts-expect-error - adding property to window
window.Automerge = Automerge;

// @ts-expect-error - adding property to window
window.repo = repo;

// Unlike other uses of mount, here we don't pass any doc URL.
// That's because DocExplorer internally expects to manage the URL hash itself.

mount(document.getElementById("root"), {});
