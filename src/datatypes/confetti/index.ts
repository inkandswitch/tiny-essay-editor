import { type DataType } from "@/os/datatypes";
export const init = (doc: any) => {};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// TODO: generalize this to a HasTitle schema?
export const markCopy = (doc: any) => {
  doc.title = `Copy of ${doc.title}`;
};

export const getTitle = async (doc: any) => {
  return doc.title;
};

export const setTitle = (doc: any, title: string) => {
  doc.title = title;
};

export const FolderDatatype: DataType<any, never, never> = {
  id: "folder",
  name: "Confetti",
  icon: "🎉",
  init,
  getTitle,
  setTitle,
  markCopy,
};
