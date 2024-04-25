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
import { mount } from "./mount.js";

const serviceWorker = await setupServiceWorker();

// This case should never happen
// if the service worker is not defined here either the initialization failed
// or we found a new case that we haven't considered yet
if (!serviceWorker) {
  throw new Error("Failed to setup service worker");
}

const repo = await setupRepo();

establishMessageChannel(serviceWorker);

async function setupServiceWorker(): Promise<ServiceWorker> {
  return navigator.serviceWorker
    .register("/service-worker.js", {
      type: "module",
    })
    .then((registration) => {
      // If the service worker is still installing, we wait until it is activated
      if (registration.installing) {
        return new Promise((resolve) => {
          registration.installing.onstatechange = (event) => {
            const serviceWorker = event.target as ServiceWorker;
            if (serviceWorker.state === "activated") {
              resolve(serviceWorker);
            }
          };
        });
      }

      // otherwise return the active service worker
      return registration.active;
    });
}

async function setupRepo() {
  await AW.promise;
  A.use(AW);

  // We create a repo without any network adapters.
  // Later we connect the repo with the repo in the service worker through a message channel
  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [],
    peerId: ("frontend-" + Math.round(Math.random() * 10000)) as PeerId,
    sharePolicy: async (peerId) => peerId.includes("service-worker"),
    // We need to enable remote heads gossiping so the remote heads of the sync server
    // are forwarded from the service worker to the repo here in the main thread
    enableRemoteHeadsGossiping: true,
  });

  return repo;
}

// Re-establish the MessageChannel if the controlling service worker changes.
navigator.serviceWorker.addEventListener("controllerchange", (event) => {
  console.log("New service worker took over");
  const serviceWorker = (event.target as ServiceWorkerContainer).controller;
  establishMessageChannel(serviceWorker);
});

// Connects the repo in the tab with the repo in the service worker through a message channel.
// The repo in the tab takes advantage of loaded state in the SW.
// TODO: clean up MessageChannels to old repos
function establishMessageChannel(serviceWorker: ServiceWorker) {
  // Send one side of a MessageChannel to the service worker and register the other with the repo.
  const messageChannel = new MessageChannel();
  repo.networkSubsystem.addNetworkAdapter(
    new MessageChannelNetworkAdapter(messageChannel.port1)
  );
  serviceWorker.postMessage({ type: "INIT_PORT" }, [messageChannel.port2]);

  console.log("Connected to service worker");
}

// Setup account

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
