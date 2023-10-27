// Used by Trail-Runner to load this as a mountable module.

import React from "react"
import ReactDom from "react-dom/client"
import App from "./components/App.js"
import { RepoContext } from "@automerge/automerge-repo-react-hooks"

import css from "./index.css"
// @ts-expect-error - i don't know why this works but it does
document.adoptedStyleSheets.push(css) 

export function mount(node, params) { 
  ReactDom.createRoot(node).render(
    // eslint-disable-next-line no-undef 
    // @ts-expect-error - repo is on window
    React.createElement(RepoContext.Provider, { value: repo }, 
      React.createElement(App, Object.assign({}, {...params, docUrl: params.documentUrl}))
    )
  ) 
}
