import * as A from "@automerge/automerge/next";
import { Repo, AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import "./index.css";
import { mount } from "./mount.js";
import { getAccount } from "./account.js";
import { timeStamp } from "console";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
});

let author: AutomergeUrl;

getAccount(repo).then((account) => {
  author = account.contactHandle.url;

  account.on("change", () => {
    author = account.contactHandle.url;
  });
});

/** monkey patch change and changeAt on doc handle
 *  always add currently logged in user as author and the current timestamp as metadata to each change
 *  todo: replace this with a proper meta data api
 */
const oldChange = DocHandle.prototype.change;
DocHandle.prototype.change = function <T>(
  callback: A.ChangeFn<T>,
  options: A.ChangeOptions<T> = {}
) {
  const optionsWithAttribution: A.ChangeOptions<T> = {
    time: Date.now(),
    message: JSON.stringify({ author }),
    ...options,
  };
  oldChange.call(this, callback, optionsWithAttribution);
};

const oldChangeAt = DocHandle.prototype.changeAt;
DocHandle.prototype.changeAt = function <T>(
  heads: A.Heads,
  callback: A.ChangeFn<T>,
  options: A.ChangeOptions<T> = {}
) {
  const optionsWithAttribution: A.ChangeOptions<T> = {
    time: Date.now(),
    message: JSON.stringify({ author }),
    ...options,
  };
  return oldChangeAt.call(this, heads, callback, optionsWithAttribution);
};

// @ts-expect-error - adding property to window
window.Automerge = Automerge;
// @ts-expect-error - adding property to window
window.repo = repo;

// Unlike other uses of mount, here we don't pass any doc URL.
// That's because DocExplorer internally expects to manage the URL hash itself.

mount(document.getElementById("root"), {});
