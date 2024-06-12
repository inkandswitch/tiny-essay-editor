import { DataType } from "@/os/datatypes";
import { ChangeGroup } from "@/os/versionControl/groupChanges";
import {
  Annotation,
  HasVersionControlMetadata,
  initVersionControlMetadata,
} from "@/os/versionControl/schema";
import { next as A } from "@automerge/automerge";
import { KanbanSquare } from "lucide-react";

// SCHEMA

export type Lane = {
  id: string;
  title: string;
  cardIds: string[];
};

export type Card = {
  id: string;
  title: string;
  description: string;
  label: string;
};

export type KanbanBoardDocAnchor =
  | { type: "card"; id: string }
  | { type: "lane"; id: string };

export type KanbanBoardDoc = {
  title: string;
  lanes: Lane[];
  cards: Card[];
} & HasVersionControlMetadata<never, never>;

// FUNCTIONS

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
const markCopy = () => {
  console.error("todo");
};

const getTitle = async (doc: KanbanBoardDoc) => {
  return doc.title;
};

const setTitle = async (doc: KanbanBoardDoc, title: string) => {
  doc.title = title;
};

const init = (doc: any) => {
  doc.title = "Untitled Board";
  doc.lanes = [];
  doc.cards = [];

  initVersionControlMetadata(doc);
};

const patchesToAnnotations = (
  doc: KanbanBoardDoc,
  docBefore: KanbanBoardDoc,
  patches: A.Patch[]
) => {
  return patches.flatMap(
    (patch): Annotation<KanbanBoardDocAnchor, undefined>[] => {
      // GL 3/15/24 This is a weird hack to detect newly added lanes.
      // When we set the ID on a lane that means we're creating it.
      // The reason we resort to this is that the insert patch doesn't have
      // the lane ID on it.
      // We probably want a better Automerge API for handling this...?
      if (
        patch.action === "splice" &&
        patch.path[0] === "lanes" &&
        patch.path[2] === "id" &&
        patch.path[3] === 0
      ) {
        const laneId = patch.value as string;
        return [
          {
            type: "added",
            added: undefined,
            anchor: { type: "lane", id: laneId },
          },
        ];
      }
      if (
        patch.action === "splice" &&
        patch.path[0] === "cards" &&
        patch.path[2] === "id" &&
        patch.path[3] === 0
      ) {
        const cardId = patch.value as string;
        return [
          {
            type: "added",
            added: undefined,
            anchor: { type: "card", id: cardId },
          },
        ];
      } else {
        return [];
      }
    }
  );
};

const fallbackSummaryForChangeGroup = (
  changeGroup: ChangeGroup<KanbanBoardDoc>
) => {
  const descriptions = {
    addCard: { singular: "card added", plural: "cards added" },
    deleteCard: { singular: "card deleted", plural: "cards deleted" },
    moveCard: { singular: "card moved", plural: "cards moved" },
    updateCard: { singular: "card updated", plural: "cards updated" },
    addLane: { singular: "lane added", plural: "lanes added" },
    deleteLane: { singular: "lane deleted", plural: "lanes deleted" },
    updateLane: { singular: "lane updated", plural: "lanes updated" },
  };

  const actionKeys = Object.keys(kanbanBoardDatatype.actions);
  const initialActionCounts: { [key: string]: number } = actionKeys.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {}
  );
  const actionCounts = changeGroup.changes.reduce(
    (acc, { metadata: { action } }) => {
      if (typeof action !== "string") return acc;
      if (!actionKeys.includes(action)) {
        console.error("weird action", action);
        return acc;
      }
      acc[action] += 1;
      return acc;
    },
    initialActionCounts
  );

  const summary = Object.entries(actionCounts)
    .filter(([, count]) => count > 0)
    .map(
      ([action, count]) =>
        `${count} ${
          count === 1
            ? descriptions[action].singular
            : descriptions[action].plural
        }`
    )
    .join(", ");

  if (summary === "") {
    return "No significant changes";
  }
  return summary;
};

const actions = {
  // TODO: there's other metadata we might want to track here:
  // - runtime checkable schema for the input arguments
  // - natural language description of the action and arguments
  // Maybe we could use decorators to add this to a TS method or something?
  addCard: (doc, { card, laneId }: { card: Card; laneId: string }) => {
    doc.cards.push({ ...card });
    const lane = doc.lanes.find((l) => l.id === laneId);
    lane.cardIds.push(card.id);
  },
  deleteCard: (doc, { cardId }: { cardId: string }) => {
    for (const lane of doc.lanes) {
      const index = [...lane.cardIds].indexOf(cardId);
      if (index > -1) {
        lane.cardIds.splice(index, 1);
      }
    }
    doc.cards.splice(
      doc.cards.findIndex((card) => card.id === cardId),
      1
    );
  },
  updateCard: (doc, { newCard }: { newCard: Card }) => {
    const cardIndex = doc.cards.findIndex((card) => card.id === newCard.id);
    const card = doc.cards[cardIndex];
    if (newCard.title && newCard.title !== card.title) {
      A.updateText(doc, ["cards", cardIndex, "title"], newCard.title);
    }
    if (newCard.description && newCard.description !== card.description) {
      if (!card.description) {
        card.description = "";
      }
      A.updateText(
        doc,
        ["cards", cardIndex, "description"],
        newCard.description
      );
    }
    if (newCard.label && newCard.label !== card.label) {
      A.updateText(doc, ["cards", cardIndex, "label"], newCard.label);
    }
  },
  moveCard: (
    doc,
    {
      fromLaneId,
      toLaneId,
      cardId,
      index,
    }: { fromLaneId: string; toLaneId: string; cardId: string; index: number }
  ) => {
    const fromLane = doc.lanes.find((l) => l.id === fromLaneId);
    const toLane = doc.lanes.find((l) => l.id === toLaneId);

    // TODO: this doesn't work if we don't copy the array; why? automerge bug?
    const oldIndex = [...fromLane.cardIds].indexOf(cardId);
    fromLane.cardIds.splice(oldIndex, 1);
    toLane.cardIds.splice(index, 0, cardId);
  },
  addLane: (doc, { lane }: { lane: { id: string; title: string } }) => {
    doc.lanes.push({ ...lane, cardIds: [] });
  },
  deleteLane: (doc, { laneId }: { laneId: string }) => {
    const lane = doc.lanes.find((l) => l.id === laneId);
    if (!lane) {
      return;
    }
    for (const cardId of lane.cardIds) {
      kanbanBoardDatatype.actions.deleteCard(doc, { cardId });
    }
    doc.lanes.splice(doc.lanes.indexOf(lane), 1);
  },
  updateLane: (doc, { laneId, newLane }: { laneId: string; newLane: Lane }) => {
    const oldLane = doc.lanes.find((l) => l.id === laneId);
    if (!oldLane) {
      return;
    }
    if (newLane.title && newLane.title !== oldLane.title) {
      A.updateText(
        doc,
        ["lanes", doc.lanes.indexOf(oldLane), "title"],
        newLane.title
      );
    }
  },
};

export const kanbanBoardDatatype: DataType<
  KanbanBoardDoc,
  KanbanBoardDocAnchor,
  undefined
> = {
  type: "patchwork:dataType",
  id: "kanban",
  name: "Kanban Board",
  icon: KanbanSquare,
  isExperimental: true,
  init,
  getTitle,
  setTitle,
  markCopy,
  fallbackSummaryForChangeGroup,
  actions,
  patchesToAnnotations,
};
