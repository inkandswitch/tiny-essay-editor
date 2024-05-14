import React from "react";
import ReactDom from "react-dom/client";
import { Explorer } from "./components/Explorer.js";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";

export function mount(node, params) {
  // workaround different conventions for documentUrl
  if (!params.docUrl && params.documentUrl) {
    params.docUrl = params.documentUrl;
  }
}
