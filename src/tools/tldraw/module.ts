import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "tldraw",
    name: "Drawing",
    supportedDatatypes: ["tldraw"],
  },

  load: () => import("./tool").then(({ DrawingTool }) => DrawingTool),
});
