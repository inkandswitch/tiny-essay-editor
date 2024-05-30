import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    id: "bot",
    name: "Bot",
    supportedDatatypes: ["bot"],
  },

  load: () => import("./tool").then(({ BotTool }) => BotTool),
});
