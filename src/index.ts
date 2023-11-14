// Used by Trail-Runner to load this as a mountable module.

import css from "./index.css"
// @ts-expect-error - i don't know why this works but it does
document.adoptedStyleSheets.push(css) 

export { mount } from "./mount.ts"
export { init } from "./init.ts"

