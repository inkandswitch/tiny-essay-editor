import { init as tldrawinit } from "automerge-tldraw";

import { PenLine } from "lucide-react";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  console.log("not implemented", doc);
};

const getTitle = (doc: any) => {
  return doc.store["document:document"].name || "Drawing";
};

const init = (doc: any) => {
  tldrawinit(doc);
  doc.store["document:document"].name = "Drawing";
};

export const TLDrawDatatype = {
  id: "tldraw",
  name: "Drawing",
  icon: PenLine,
  init,
  getTitle,
};
