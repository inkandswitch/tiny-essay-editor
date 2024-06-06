import { DataTypeWitoutMetaData } from "@/os/datatypes";
import { ModuleDoc } from "./schema";

export const init = (doc: any) => {
  doc.title = "Untitled Module";
  doc.docs = [];
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// TODO: generalize this to a HasTitle schema?
export const markCopy = (doc: ModuleDoc) => {
  doc.title = `Copy of ${doc.title}`;
};

export const getTitle = async (doc: any) => {
  return doc.title;
};

export const setTitle = (doc: ModuleDoc, title: string) => {
  doc.title = title;
};

export const ModuleDataType: DataTypeWitoutMetaData<ModuleDoc, never, never> = {
  init,
  getTitle,
  setTitle,
  markCopy,
};
