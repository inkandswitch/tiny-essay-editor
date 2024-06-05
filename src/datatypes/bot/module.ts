import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Module } from "@/os/modules";
import { Bot } from "lucide-react";
import { EssayEditingBotDoc } from "./schema";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<EssayEditingBotDoc, never, never>
>({
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
});
