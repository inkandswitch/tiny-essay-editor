import { uuid } from "@automerge/automerge";
import { KanbanSquare } from "lucide-react";

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
  const defaultLaneId = uuid();
  doc.lanes = [{ id: defaultLaneId, title: "Lane 1", cardIds: [] }];
  doc.cards = [];
};

export const KanbanBoardDatatype = {
  id: "kanban",
  name: "Kanban Board",
  icon: KanbanSquare,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
};
