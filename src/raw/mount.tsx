import React from "react";
import ReactDom from "react-dom/client";
import { RawView } from "./components/RawView.js";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

export function mount(node, params) {
  ReactDom.createRoot(node).render(
  <RepoContext.Provider value={repo}> 
      <RawView {...params}/>
    </RepoContext.Provider>
  ) 
}
