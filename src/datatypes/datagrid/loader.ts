import { DataTypeLoaderConfig } from "@/os/datatypes";
import { Sheet } from "lucide-react";
import { DataGridDoc, DataGridDocAnchor } from "./schema";

export default {
  metadata: {
    id: "datagrid",
    name: "Spreadsheet",
    icon: Sheet,
    isExperimental: true,
  },

  load: () =>
    import("./datatype").then(({ DataGridDatatype }) => DataGridDatatype),
} as DataTypeLoaderConfig<DataGridDoc, DataGridDocAnchor, never>;
