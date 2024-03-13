import { DataType } from "@/DocExplorer/doctypes";
import { uuid } from "@automerge/automerge";
import { Martini } from "lucide-react";
import { RichTeeDoc } from "./schema";
import { next as Automerge } from "@automerge/automerge";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
export const markCopy = () => {
  console.error("todo");
};

const getTitle = (doc: any) => {
  return doc.title;
};

export const init = (doc: any) => {
  doc.title = "Untitled Board";
  doc.text = "";
  Automerge.splitBlock(doc, ["text"], 0, {
    type: "paragraph",
    parents: ["blockquote", "unordered-list-item"],
    attrs: {},
  });
  Automerge.splice(doc, ["text"], 1, 0, "some quote");
  const defaultLaneId = uuid();
  doc.lanes = [{ id: defaultLaneId, title: "Lane 1", cardIds: [] }];
  doc.cards = [];

  // todo: i think we need to init patchwork metadata here?
};

export const RichTeeDatatype: DataType<RichTeeDoc, unknown, unknown> = {
  id: "richtee",
  name: "Rich Tee",
  icon: Martini,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
};
