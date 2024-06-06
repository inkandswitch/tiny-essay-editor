import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "module",
    name: "Module",
    supportedDatatypes: ["module"],
  },

  load: () => import("./tool").then(({ FolderViewerTool }) => FolderViewerTool),
});
