import { TLDrawDatatype } from "@/tldraw/datatype";
import { DataGridDatatype } from "@/datagrid/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { EssayEditingBotDatatype } from "@/bots/datatype";
import { Repo } from "@automerge/automerge-repo";

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
  datagrid: DataGridDatatype,
  bot: EssayEditingBotDatatype,
} as const;

export type DocType = keyof typeof docTypes;
