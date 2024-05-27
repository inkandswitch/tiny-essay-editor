import { Tool } from "@/os/tools";
import { KanbanBoard } from './KanbanBoard.js';

export default {
  id: "kanban",
  name: "Kanban",
  editorComponent: KanbanBoard,
} as Tool;
