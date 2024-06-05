import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "kanban",
    name: "Kanban",
    supportedDatatypes: ["kanban"],
  },

  load: () => import("./tool").then(({ KanbanTool }) => KanbanTool),
});
