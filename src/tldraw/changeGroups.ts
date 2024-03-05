import { ChangeGroup, ChangeGroupingOptions } from "@/patchwork/groupChanges";

import { DecodedChange, Patch } from "@automerge/automerge-wasm";
import { TLDrawDoc } from "./schema";
import { GROUPINGS } from "@/patchwork/groupChanges";

export const changeFilter = ({
  doc,
  decodedChange,
}: {
  doc: TLDrawDoc;
  decodedChange: DecodedChange;
}) => {
  return true;
};

export const changeGroupingOptions: ChangeGroupingOptions<TLDrawDoc, never> = {
  grouping: GROUPINGS.ByAuthorOrTime,
  numericParameter: 10,
  changeFilter,
  markers: [],
};
