import { init as tldrawinit } from "automerge-tldraw"

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  console.log("not implemented", doc)
}

const getTitle = (doc: any) => {
  return doc.store["document:document"].name || "Drawing"
}

const init = (doc: any) => {
  return tldrawinit(doc)
}

export const TLDrawDatatype = {
  id: "essay",
  name: "Essay",
  icon: Text,
  init,
  getTitle,
}
