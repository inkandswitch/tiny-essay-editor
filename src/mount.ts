import React from "react"
import ReactDom from "react-dom/client"
import App from "./components/App.js"
import { RepoContext } from "@automerge/automerge-repo-react-hooks"

export function mount(node, params) { 
  // workaround different conventions for documentUrl
  if (!params.docUrl && params.documentUrl) {
    params.docUrl = params.documentUrl
  }

  ReactDom.createRoot(node).render(
    // eslint-disable-next-line no-undef 
    // @ts-expect-error - repo is on window
    React.createElement(RepoContext.Provider, { value: repo }, 
      React.createElement(App, Object.assign({}, params))
    )
  ) 
}
