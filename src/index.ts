// Used by Trail-Runner to load this as a mountable module.

import React from "react"
import ReactDom from "react-dom/client"
import App from "./components/App.js"
import { RepoContext } from "@automerge/automerge-repo-react-hooks"

export function mount(node, params) { 
  ReactDom.createRoot(node).render(
    // eslint-disable-next-line no-undef 
    React.createElement(RepoContext.Provider, { value: repo }, 
      React.createElement(App, Object.assign({}, params))
    )
  ) 
}
