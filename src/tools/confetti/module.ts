import { Module } from "@/os/modules";
import { Tool, ToolMetaData } from "@/os/tools";

export default new Module<ToolMetaData, Tool>({
  metadata: {
    name: "Confetti",
    id: "confetti",
    supportedDatatypes: ["*"],
  },

  load: () => import("./tool").then(({ ConfettiTool }) => ConfettiTool),
});
