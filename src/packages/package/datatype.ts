import { DataType } from "@/os/datatypes";
import { Package } from "lucide-react";

// SCHEMA

type UrlSource = {
  type: "url";
  url: string;
};

type AutomergeDocSource = {
  type: "automerge";
  "index.js": {
    contentType: "application/javascript";
    contents: string;
  };
};

type PackageSource = UrlSource | AutomergeDocSource;

export type PackageDoc = {
  title: string;
  source: PackageSource;
};

// FUNCTIONS

export const init = (doc: any) => {
  doc.title = "Untitled Module";
  doc.source = { type: "url", url: "" };
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// TODO: generalize this to a HasTitle schema?
export const markCopy = (doc: PackageDoc) => {
  doc.title = `Copy of ${doc.title}`;
};

export const getTitle = async (doc: any) => {
  return doc.title;
};

export const setTitle = (doc: PackageDoc, title: string) => {
  doc.title = title;
};

export const packageDataType: DataType<PackageDoc, never, never> = {
  type: "patchwork:datatype",
  name: "Module",
  icon: Package,
  isExperimental: true,
  init,
  getTitle,
  setTitle,
  markCopy,
};
