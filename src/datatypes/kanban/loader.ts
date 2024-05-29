import { DataTypeLoaderConfig } from "@/os/datatypes";
import { KanbanSquare } from "lucide-react";
import { KanbanBoardDoc } from "./schema";

export default {
  metadata: {
    id: "kanban",
    name: "Kanban Board",
    icon: KanbanSquare,
    isExperimental: true,
  },

  load: () =>
    import("./datatype").then(({ KanbanBoardDatatype }) => KanbanBoardDatatype),
} as DataTypeLoaderConfig<KanbanBoardDoc, never, string>;
