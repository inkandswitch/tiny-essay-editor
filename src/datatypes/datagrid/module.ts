import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Module } from "@/os/modules";
import { Sheet } from "lucide-react";
import { DataGridDoc, DataGridDocAnchor } from "./schema";

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
