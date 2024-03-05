import { Sheet } from "lucide-react";

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
  const rows = 20;
  const cols = 10;
  const defaultValue = "";
  doc.data = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => defaultValue)
  );
};

export const DataGridDatatype = {
  id: "datagrid",
  name: "DataGrid",
  icon: Sheet,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
};
