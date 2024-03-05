import { ChangeGroupingOptions } from "@/patchwork/groupChanges";

import { DecodedChange, Patch } from "@automerge/automerge-wasm";
import { MarkdownDoc } from "./schema";
import { GROUPINGS } from "@/patchwork/groupChanges";

import * as A from "@automerge/automerge/next";
import { HasPatchworkMetadata } from "@/patchwork/schema";

export type MarkdownDocChangeGroupStats = {
  /* number of distinct edit ranges */
  editCount: number;

  charsAdded: number;
  charsDeleted: number;
  headings: Heading[];
  commentsAdded: number;
};

export type Heading = {
  index: number;
  text: string;
  patches: Patch[];
};

// Given a change, should it be shown to the user in the log?
export const includeChange = ({
  doc,
  decodedChange,
}: {
  doc: MarkdownDoc;
  decodedChange: DecodedChange;
}) => {
  const contentObjID = A.getObjectId(doc, "content");
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return decodedChange.ops.some(
    (op) => op.obj === contentObjID || op.obj === commentsObjID
  );
};

export const changeGroupingOptions: ChangeGroupingOptions<MarkdownDoc> = {
  grouping: GROUPINGS.ByAuthorOrTime,
  numericParameter: 60,
  changeFilter: includeChange,
  markers: [],
};
