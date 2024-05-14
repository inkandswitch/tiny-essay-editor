import { DataType } from "@/os/datatypes";
import { FolderIcon } from "lucide-react";
import { FolderDoc } from ".";

export const init = (doc: any) => {
  doc.title = "Untitled Folder";
  doc.docs = [];
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// TODO: generalize this to a HasTitle schema?
export const markCopy = (doc: FolderDoc) => {
  doc.title = `Copy of ${doc.title}`;
};

export const getTitle = async (doc: any) => {
  return doc.title;
};

export const setTitle = (doc: FolderDoc, title: string) => {
  doc.title = title;
};

export const FolderDatatype: DataType<FolderDoc, never, never> = {
  id: "folder",
  name: "Folder",
  icon: FolderIcon,
  init,
  getTitle,
  setTitle,
  markCopy,
};
