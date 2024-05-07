import { TLDrawDatatype } from "./tldraw/datatype";
import { EssayDatatype } from "./tee/datatype";
import { FolderDatatype } from "./folders/datatype";
import { Repo } from "@automerge/automerge-repo";

// TODO: make this generically typed
export interface DataType {
  id: string;
  name: string;
  icon: any;
  init: (doc: any, repo: Repo) => void;
  getTitle: (doc: any) => string;
  setTitle?: (doc: any, title: string) => void;
  markCopy: (doc: any) => void;
}

export const datatypes: Record<string, DataType> = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
  folder: FolderDatatype,
} as const;

export type DatatypeId = keyof typeof datatypes;
