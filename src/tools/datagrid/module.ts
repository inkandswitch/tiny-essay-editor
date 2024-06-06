import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    name: "Spreadsheet",
    id: "datagrid",
    supportedDatatypes: ["datagrid"],
  },

  load: () => import("./tool").then(({ SpreadsheetTool }) => SpreadsheetTool),
});
