import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "essay",
    name: "Editor",
    supportedDatatypes: ["essay"],
  },

  load: () => import("./tool").then(({ EssayEditorTool }) => EssayEditorTool),
});
