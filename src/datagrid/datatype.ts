import { Sheet } from "lucide-react";
import { DataGridDoc } from "./schema";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { next as A } from "@automerge/automerge";
import { DataType } from "@/DocExplorer/doctypes";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  doc.title = "Copy of " + doc.title;
};

const getTitle = (doc: any) => {
  return doc.title || "Mystery Data Grid";
};

export const init = (doc: any) => {
  doc.title = "Untitled Spreadsheet";
  const rows = 100;
  const cols = 26;
  const defaultValue = "";
  doc.data = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => defaultValue)
  );
};

export const includeChangeInHistory = (
  doc: DataGridDoc,
  decodedChange: DecodedChangeWithMetadata
) => {
  const dataObjId = A.getObjectId(doc, "data");
  // GL 3/11/24: this is miserable, we need to collect a whole bunch of object ids
  // for the rows inside the data object in order to filter changes.
  // It'd be much nicer to check "is this change working somewhere within this path".
  const rowObjIds = doc.data.map((_, index) => A.getObjectId(doc.data, index));
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return decodedChange.ops.some(
    (op) =>
      op.obj === dataObjId ||
      rowObjIds.includes(op.obj) ||
      op.obj === commentsObjID
  );
};

export const includePatchInChangeGroup = (patch: A.Patch) =>
  patch.path[0] === "data" || patch.path[0] === "commentThreads";

export const DataGridDatatype: DataType<DataGridDoc> = {
  id: "datagrid",
  name: "DataGrid",
  icon: Sheet,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here

  includeChangeInHistory,
  includePatchInChangeGroup,
};
