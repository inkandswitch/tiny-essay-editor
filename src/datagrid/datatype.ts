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
  doc.title = "A Data Grid";
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
  const contentObjID = A.getObjectId(doc, "data");
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return decodedChange.ops.some(
    (op) => op.obj === contentObjID || op.obj === commentsObjID
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
