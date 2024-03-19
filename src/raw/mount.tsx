import React from "react";
import ReactDom from "react-dom/client";
import { RawView } from "./components/RawView.js";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

export function mount(node, params) {
  ReactDom.createRoot(node).render(
    // @ts-expect-error -- the repo is set as a project-level global; we should clean this up but... later
    <RepoContext.Provider value={repo}> 
      <RawView {...params}/>
    </RepoContext.Provider>
  ) 
}
