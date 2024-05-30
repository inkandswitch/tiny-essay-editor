import {
  DataTypeLoaderConfig,
  DataTypeMetadata,
  DataTypeWitoutMetaData,
} from "@/os/datatypes";
import { KanbanSquare } from "lucide-react";
import { KanbanBoardDoc, KanbanBoardDocAnchor } from "./schema";
import { Module } from "@/os/modules";

export default new Module<
  DataTypeMetadata,
  DataTypeWitoutMetaData<KanbanBoardDoc, KanbanBoardDocAnchor, undefined>
>({
  metadata: {
    id: "kanban",
    name: "Kanban Board",
    icon: KanbanSquare,
    isExperimental: true,
  },

  load: () =>
    import("./datatype").then(({ KanbanBoardDatatype }) => KanbanBoardDatatype),
});
