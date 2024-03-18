import { PenLine } from "lucide-react";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  doc.title = "Copy of " + doc.title;
};

const getTitle = (doc: any) => {
  return doc.title || "Untitled Document";
};

export const init = () => {
  // do nothing here
};

export const RawDatatype = {
  id: "raw",
  name: "Raw",
  icon: PenLine,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
};
