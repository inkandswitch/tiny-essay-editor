import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App.tsx";
import "./index.css";

import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as Automerge } from "@automerge/automerge"; //why `next`? See the the "next" section of the conceptual overview
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { MarkdownDoc } from "./schema.ts";
import { sortBy } from "lodash";

const repo = new Repo({
  network: [
    new BroadcastChannelNetworkAdapter(),
    new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
  ],
  storage: new IndexedDBStorageAdapter(),
});

const LAB_USERS = sortBy(
  [
    "Geoffrey Litt",
    "Paul Sonnentag",
    "Alexander Obenauer",
    "Peter van Hardenberg",
    "James Lindenbaum",
    "Marcel Goethals",
    "Ivan Reese",
    "Alex Warth",
    "Todd Matthews",
    "Alex Good",
    "Orion Henry",
    "Mary Rose Cook",
  ],
  (name) => name.toLowerCase()
);

const rootDocUrl = `${document.location.hash.substr(1)}`;
let handle;
if (isValidAutomergeUrl(rootDocUrl)) {
  handle = repo.find(rootDocUrl);
} else {
  handle = repo.create<MarkdownDoc>();
  handle.change((d) => {
    d.content = "# Untitled\n\n";
    d.commentThreads = {};
    d.users = [];
    for (const name of LAB_USERS) {
      const idStr = name.toLowerCase().replace(" ", "-");
      const user = { id: idStr, name };
      d.users.push(user);
    }
  });
}

// eslint-disable-next-line
const docUrl = (document.location.hash = handle.url);

// @ts-expect-error - adding property to window
window.Automerge = Automerge;
// @ts-expect-error - adding property to window
window.repo = repo;
// @ts-expect-error - adding property to window
window.handle = handle; // we'll use this later for experimentation

ReactDOM.createRoot(document.getElementById("root")!).render(
  // TODO: we disabled strict mode to avoid double-creation of editor;
  // need to patch up the useEffect in MarkdownEditor to handle async destroy
  // <React.StrictMode>
  <RepoContext.Provider value={repo}>
    <App docUrl={docUrl} repo={repo} />
  </RepoContext.Provider>
  // </React.StrictMode>
);
