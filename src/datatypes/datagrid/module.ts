import {
  DataTypeLoaderConfig,
  DataTypeMetadata,
  DataTypeWitoutMetaData,
} from "@/os/datatypes";
import { Sheet } from "lucide-react";
import { DataGridDoc, DataGridDocAnchor } from "./schema";
import { Module } from "@/os/modules";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<DataGridDoc, DataGridDocAnchor, string>
>({
  metadata: {
    id: "datagrid",
    name: "Spreadsheet",
    icon: Sheet,
    isExperimental: true,
  },

  load: () =>
    import("./datatype").then(({ DataGridDatatype }) => DataGridDatatype),
});
