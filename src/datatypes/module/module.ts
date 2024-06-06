import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Package } from "lucide-react";
import { ModuleDoc } from "./schema";
import { Module } from "@/os/modules";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<ModuleDoc, never, never>
>({
  metadata: {
    id: "module",
    name: "Module",
    icon: Package,
    isExperimental: true,
  },

  load: () => import("./datatype").then(({ ModuleDataType }) => ModuleDataType),
});
