// Used by Trail-Runner to load this as a mountable module.

import css from "./index.css"
// @ts-expect-error - i don't know why this works but it does
document.adoptedStyleSheets.push(css)

export { mount } from "./tldraw/mount.js"
export { init } from "./tldraw/datatype.js"

// @ts-expect-error - set a window global for the logo image using browser standards
window.logoImageUrl = new URL(
  "./assets/logo-favicon-310x310-transparent.png",
  import.meta.url
).href
