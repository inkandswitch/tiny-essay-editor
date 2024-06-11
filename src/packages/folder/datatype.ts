import { DataType, DatatypeId } from "@/os/datatypes";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { Folder } from "lucide-react";

// SCHEMA

// A type representing a folder where the contents are either links to regular docs,
// or links to folders, in which case we have access to the contents of the folder
export type FolderDocWithChildren = Omit<FolderDoc, "docs"> & {
  docs: (DocLink & {
    folderContents?: FolderDocWithChildren;
  })[];
};

export type DocLink = {
  name: string;
  type: DatatypeId;
  url: AutomergeUrl;
  branchUrl?: AutomergeUrl;
  branchName?: string;
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
} & HasVersionControlMetadata<never, never>;

// FUNCTIONS

const init = (doc: any) => {
  doc.title = "Untitled Folder";
  doc.docs = [];
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// TODO: generalize this to a HasTitle schema?
const markCopy = (doc: FolderDoc) => {
  doc.title = `Copy of ${doc.title}`;
};

const getTitle = async (doc: any) => {
  return doc.title;
};

const setTitle = (doc: FolderDoc, title: string) => {
  doc.title = title;
};

export const folderDatatype: DataType<FolderDoc, never, never> = {
  type: "patchwork:datatype",
  name: "Folder",
  icon: Folder,
  init,
  getTitle,
  setTitle,
  markCopy,
};
