import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Folder } from "lucide-react";
import { FolderDoc } from "./schema";
import { Module } from "@/os/modules";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<FolderDoc, never, never>
>({
  metadata: {
    id: "folder",
    name: "Folder",
    icon: Folder,
  },

  load: () => import("./datatype").then(({ FolderDatatype }) => FolderDatatype),
});
