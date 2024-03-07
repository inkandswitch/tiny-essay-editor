import { next as A } from "@automerge/automerge";
import { TLDrawDatatype } from "@/tldraw/datatype";
import { DataGridDatatype } from "@/datagrid/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { EssayEditingBotDatatype } from "@/bots/datatype";
import { Repo } from "@automerge/automerge-repo";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { TextPatch } from "@/patchwork/utils";

export interface DataType<T> {
  id: string;
  name: string;
  icon: any;
  init: (doc: T, repo: Repo) => void;
  getTitle: (doc: T, repo: Repo) => Promise<string>;
  markCopy: (doc: T) => void; // TODO: this shouldn't be part of the interface

  // version related functions
  includeChangeInHistory?: (
    doc: T,
    change: DecodedChangeWithMetadata
  ) => boolean;
  includePatchInChangeGroup?: (patch: A.Patch | TextPatch) => boolean; // todo: can we get rid of TextPatch here?

  // a textual representation of the document that can be used in prompts
  getLLMSummary?: (doc: T) => string;
}

export const docTypes: Record<string, DataType<HasPatchworkMetadata>> = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
  datagrid: DataGridDatatype,
  bot: EssayEditingBotDatatype,
} as const;

export type DocType = keyof typeof docTypes;
