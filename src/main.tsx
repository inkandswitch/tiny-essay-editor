import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App.tsx";
import "./index.css";

import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
// import { next as A } from "@automerge/automerge"; //why `next`? See the the "next" section of the conceptual overview
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { MarkdownDoc } from "./schema.ts";

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
  handle.change((d) => {
    d.content = "This is a **Markdown document**.";
    d.commentThreads = {};
    d.users = [
      { id: "1", name: "Geoffrey Litt" },
      { id: "2", name: "Paul Sonnentag" },
      { id: "3", name: "Alexander Obenauer" },
      { id: "4", name: "Peter van Hardenberg" },
    ];
  });
}

// eslint-disable-next-line
const docUrl = (document.location.hash = handle.url);

// @ts-expect-error - adding property to window
window.handle = handle; // we'll use this later for experimentation

ReactDOM.createRoot(document.getElementById("root")!).render(
  // TODO: we disabled strict mode to avoid double-creation of editor;
  // need to patch up the useEffect in MarkdownEditor to handle async destroy
  // <React.StrictMode>
  <RepoContext.Provider value={repo}>
    <App docUrl={docUrl} />
  </RepoContext.Provider>
  // </React.StrictMode>
);
