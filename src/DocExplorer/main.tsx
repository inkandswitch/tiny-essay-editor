import * as A from "@automerge/automerge";
import * as AW from "@automerge/automerge-wasm";
import {
  Repo,
  AutomergeUrl,
  DocHandle,
  PeerId,
} from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge";

import "./index.css";
import { getAccount } from "./account.js";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { useCurrentUrlPath } from "./navigation.js";
import { mount } from "./mount.js";

// First, spawn the serviceworker.
async function setupServiceWorker() {
  const registration = await navigator.serviceWorker.register(
    "/service-worker.js",
    {
      type: "module",
    }
  );
  console.log(
    "ServiceWorker registration successful with scope:",
    registration.scope
  );
}

// Then set up an automerge repo (loading with our annoying WASM hack)
async function setupRepo() {
  await AW.promise;
  A.use(AW);

  // no network, no storage... not yet.
  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [],
    peerId: ("frontend-" + Math.round(Math.random() * 10000)) as PeerId,
    sharePolicy: async (peerId) => peerId.includes("service-worker"),
    enableRemoteHeadsGossiping: true,
  });

  return repo;
}

// Now introduce the two to each other. This frontend takes advantage of loaded state in the SW.
function establishMessageChannel(repo) {
  if (!navigator.serviceWorker.controller) {
    console.log("No service worker is controlling this tab right now.");
    return;
  }

  // Send one side of a MessageChannel to the service worker and register the other with the repo.
  const messageChannel = new MessageChannel();
  repo.networkSubsystem.addNetworkAdapter(
    new MessageChannelNetworkAdapter(messageChannel.port1)
  );
  navigator.serviceWorker.controller.postMessage({ type: "INIT_PORT" }, [
    messageChannel.port2,
  ]);
}

// (Actually do the things above here.)
await setupServiceWorker();
const repo = await setupRepo();
establishMessageChannel(repo);

let author: AutomergeUrl;

getAccount(repo).then((account) => {
  author = account.contactHandle.url;

  account.on("change", () => {
    author = account.contactHandle.url;
  });
});

/** Here we monkey patch the DocHandle to
 *  always add the currently logged in user as author
 *  and the current timestamp as metadata to each change.
 *
 *  Eventually, we would like to ship this functionality directly
 *  inside automerge-repo, but that's currently blocked on having a
 *  more efficient approach to storing change metadata in Automerge.
 *
 *  Once that's done we should remove this monkey patch.
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
// todo: with the new url format mount doesn't work anymore in trail runner, because we take over the url

mount(document.getElementById("root"), {});
