// Currently this is a loose collection of operations related to the
// MarkdownDoc datatype.
// It will become more structured in future work on schemas / datatypes.

import { FolderIcon } from "lucide-react";
import { DocType } from "@/DocExplorer/doctypes";
import { AutomergeUrl } from "@automerge/automerge-repo";

export type DocLink = {
  name: string;
  type: DocType;
  url: AutomergeUrl;
};

export type DocLinkWithFolderPath = DocLink & {
  /** A list of URLs to folder docs that make up the path to this link.
   *  Always contains at least one URL: the root folder for the user
   */
  folderPath: AutomergeUrl[];
};

export type FolderDoc = {
  title: string;
  docs: DocLink[];
};

// A type representing a folder where the contents are either links to regular docs,
// or links to folders, in which case we have access to the contents of the folder
export type FolderDocWithChildren = Omit<FolderDoc, "docs"> & {
  docs: (DocLink & {
    folderContents?: FolderDocWithChildren;
  })[];
};

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

export const FolderDatatype = {
  id: "folder",
  name: "Folder",
  icon: FolderIcon,
  init,
  getTitle,
  setTitle,
  markCopy,
};
