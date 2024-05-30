import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "folder",
    name: "Folder",
    supportedDatatypes: ["folder"],
  },

  load: () => import("./tool").then(({ FolderViewerTool }) => FolderViewerTool),
});
