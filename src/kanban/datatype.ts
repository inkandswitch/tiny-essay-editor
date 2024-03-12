import { DataType } from "@/DocExplorer/doctypes";
import { uuid } from "@automerge/automerge";
import { KanbanSquare } from "lucide-react";
import { Card, KanbanBoardDoc } from "./schema";

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

  // todo: i think we need to init patchwork metadata here?
};

export const KanbanBoardDatatype: DataType<KanbanBoardDoc, unknown, unknown> = {
  id: "kanban",
  name: "Kanban Board",
  icon: KanbanSquare,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
  methods: {
    // TODO: there's other metadata we might want to track here:
    // - runtime checkable schema for the input arguments
    // - natural language description of the action and arguments
    // Maybe we could use decorators to add this to a TS method or something?
    addCard: (handle, card: Card, laneId: string) => {
      handle.change(
        (doc: KanbanBoardDoc) => {
          doc.cards.push({ ...card });
          const lane = doc.lanes.find((l) => l.id === laneId);
          lane.cardIds.push(card.id);
        },

        // TODO: generalize this to all methods automatically..?
        { metadata: { method: "addCard" } }
      );
    },
  },
};
