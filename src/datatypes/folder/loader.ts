import { DataTypeLoaderConfig } from "@/os/datatypes";
import { Folder } from "lucide-react";
import { FolderDoc } from "./schema";

export default {
  metadata: {
    id: "folder",
    name: "Folder",
    icon: Folder,
  },

  load: () => import("./datatype").then(({ FolderDatatype }) => FolderDatatype),
} as DataTypeLoaderConfig<FolderDoc, never, string>;
