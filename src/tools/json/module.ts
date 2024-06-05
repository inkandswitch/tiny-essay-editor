import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "json",
    name: "JSON",
    supportedDatatypes: ["*"],
  },

  load: () => import("./tool").then(({ JSONTool }) => JSONTool),
});
