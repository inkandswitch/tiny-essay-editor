import React from "react";
import ReactDom from "react-dom/client";
import { Knapsack } from "./components/Knapsack.js";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

export function mount(node, params) {
  // workaround different conventions for documentUrl
  if (!params.docUrl && params.documentUrl) {
    params.docUrl = params.documentUrl;
  }

  ReactDom.createRoot(node).render(
    // We get the Automerge Repo from the global window;
    // this is set by either our standalone entrypoint or trailrunner
    React.createElement(
      RepoContext.Provider,
      // eslint-disable-next-line no-undef
      // @ts-expect-error - repo is on window
      { value: repo },
      React.createElement(Knapsack, Object.assign({}, params))
    )
  );
}
