import { DataTypeLoaderConfig } from "@/os/datatypes";
import { Bot } from "lucide-react";
import { EssayEditingBotDoc } from "./schema";

export default {
  metadata: {
    id: "bot",
    name: "Bot",
    icon: Bot,
    isExperimental: true,
  },

  load: () =>
    import("./datatype").then(
      ({ EssayEditingBotDatatype }) => EssayEditingBotDatatype
    ),
} as DataTypeLoaderConfig<EssayEditingBotDoc, never, never>;
