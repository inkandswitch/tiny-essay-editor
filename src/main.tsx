import React from "react";
import ReactDOM from "react-dom/client";
import App, { TextDoc } from "./App.tsx";
import "./index.css";

import { isValidAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { next as A } from "@automerge/automerge"; //why `next`? See the the "next" section of the conceptual overview
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

const repo = new Repo({
  network: [new BroadcastChannelNetworkAdapter()],
  storage: new IndexedDBStorageAdapter(),
});

const rootDocUrl = `${document.location.hash.substr(1)}`;
let handle;
if (isValidAutomergeUrl(rootDocUrl)) {
  handle = repo.find(rootDocUrl);
} else {
  handle = repo.create<TextDoc>();
  handle.change((d) => (d.content = "hello world"));
}

// eslint-disable-next-line
const docUrl = (document.location.hash = handle.url);

// @ts-expect-error - adding property to window
window.handle = handle; // we'll use this later for experimentation

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RepoContext.Provider value={repo}>
      <App docUrl={docUrl} />
    </RepoContext.Provider>
  </React.StrictMode>
);
