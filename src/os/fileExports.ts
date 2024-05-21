import { Doc, save } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";

export type FileExportMethod<D> = {
  id: string;
  name: string;
  export: (doc: Doc<D>, repo: Repo) => Promise<Blob> | Blob;
  contentType: string;
  extension: string;
};

const rawAutomergeExport: FileExportMethod<any> = {
  id: "automerge",
  name: "Automerge Binary",
  export: (doc) => new Blob([save(doc)], { type: "application/octet-stream" }),
  contentType: "application/octet-stream",
  extension: "automerge",
};

const jsonExport: FileExportMethod<any> = {
  id: "json",
  name: "JSON",
  export: (doc) =>
    new Blob([JSON.stringify(doc)], { type: "application/json" }),
  contentType: "application/json",
  extension: "json",
};

export const genericExportMethods = [rawAutomergeExport, jsonExport];
