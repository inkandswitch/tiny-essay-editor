import * as AutomergeWasm from "@automerge/automerge-wasm";
import * as Automerge from "@automerge/automerge";
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

const CACHE_NAME = "v6";

async function initializeRepo() {
  console.log("Creating repo");
  const repo = new Repo({
    storage: new IndexedDBStorageAdapter(),
    network: [new BrowserWebSocketClientAdapter("wss://sync.automerge.org")],
    peerId: "service-worker-" + Math.round(Math.random() * 1000000),
    sharePolicy: async (peerId) => peerId.includes("storage-server"),
  });

  await AutomergeWasm.promise;
  Automerge.use(AutomergeWasm);

  return repo;
}

console.log("Before registration");
const repo = initializeRepo();

// put it on the global context for interactive use
repo.then((r) => {
  self.repo = r;
  self.Automerge = Automerge;
});

// return a promise from this so that we can wait on it before returning fetch/addNetworkAdapter
// because otherwise we might not have the WASM module loaded before we get to work.

self.addEventListener("install", (event) => {
  console.log("Installing SW");
  self.skipWaiting();
});

self.addEventListener("message", async (event) => {
  console.log("Client messaged", event.data);
  if (event.data && event.data.type === "INIT_PORT") {
    const clientPort = event.ports[0];
    (await repo).networkSubsystem.addNetworkAdapter(
      new MessageChannelNetworkAdapter(clientPort, { useWeakRef: true })
    );
  }
});

function addSyncServer(url) {
  repo.then((repo) =>
    repo.networkSubsystem.addNetworkAdapter(
      new BrowserWebSocketClientAdapter(url)
    )
  );
}
self.addSyncServer = addSyncServer;

async function clearOldCaches() {
  const cacheWhitelist = [CACHE_NAME];
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames.map((cacheName) => {
    if (!cacheWhitelist.includes(cacheName)) {
      return caches.delete(cacheName);
    }
  });
  await Promise.all(deletePromises);
}

self.addEventListener("activate", async (event) => {
  console.log("Activating service worker.");
  await clearOldCaches();
  clients.claim();
});

self.addEventListener("fetch", async (event) => {
  const url = new URL(event.request.url);

  const match = url.pathname.match(
    new RegExp("^.*/automerge-repo/(automerge:.*)")
  );
  if (match) {
    event.respondWith(
      (async () => {
        let [docUrl, ...path] = match[1].split("/");

        if (!isValidAutomergeUrl(docUrl)) {
          return new Response(`Invalid Automerge URL\n${docUrl}`, {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        }

        const handle = (await repo).find(docUrl);
        await handle.whenReady();
        const doc = await handle.doc();

        if (!doc) {
          return new Response(
            `Document unavailable.\n${docUrl}: ${handle.state}`,
            {
              status: 500,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        // This is a bit of a hack but helps with JSPM looking for package.json
        // at the root. It might actually not do that now I think about it.
        if (path[0] === "package.json") {
          return new Response(JSON.stringify(doc));
        }

        const subTree = path.reduce((acc, curr) => acc?.[curr], doc);
        if (!subTree) {
          return new Response(
            `Not found\nObject path: ${path}\n${JSON.stringify(doc, null, 2)}`,
            {
              status: 404,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        if (subTree.contentType) {
          return new Response(subTree.contents, {
            headers: { "Content-Type": subTree.contentType },
          });
        }

        // This doesn't work for a RawString...
        // (Sorry if you're here because of that.)
        if (typeof subTree === "string") {
          return new Response(subTree, {
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response(JSON.stringify(subTree), {
          headers: { "Content-Type": "application/json" },
        });
      })()
    );
  }
  // disable caching files for now
  /* else if (event.request.method === "GET" && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const r = await caches.match(event.request)
        console.log(`[Service Worker] Fetching resource from cache: ${event.request.url}`)
        if (r) {
          return r
        }
        const response = await fetch(event.request)
        const cache = await caches.open(CACHE_NAME)
        console.log(`[Service Worker] Caching new resource: ${event.request.url}`)
        cache.put(event.request, response.clone())
        return response
      })()
    ) 
  } */
});
