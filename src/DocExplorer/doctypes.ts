import { TLDrawDatatype } from "@/tldraw/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { EssayEditingBotDatatype } from "@/bots/datatype";
import { Repo } from "@automerge/automerge-repo";
import { KanbanBoardDatatype } from "@/kanban/datatype";

export interface DataType {
  id: string;
  name: string;
  icon: any;
  init: (doc: any, repo: Repo) => void;
  getTitle: (doc: any) => string;
  markCopy: (doc: any) => void;
}

export const docTypes = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
  bot: EssayEditingBotDatatype,
  kanban: KanbanBoardDatatype,
} as const;

export type DocType = keyof typeof docTypes;
