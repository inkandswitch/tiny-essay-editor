import { HasVersionControlMetadata } from "@/os/versionControl/schema";

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
