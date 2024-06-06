import { DataTypeMetadata, DataTypeWitoutMetaData } from "@/os/datatypes";
import { Module } from "@/os/modules";
import { KanbanSquare } from "lucide-react";
import { KanbanBoardDoc, KanbanBoardDocAnchor } from "./schema";

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
