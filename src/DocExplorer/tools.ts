import React from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";
import { FolderViewer } from "@/folders/components/FolderViewer";
import { DataGrid } from "@/datagrid/components/DataGrid";
import { BotEditor } from "@/bots/BotEditor";
import { KanbanBoard } from "@/kanban/components/Kanban";
import { DocEditorProps } from "./datatypes";

export type Tool = {
  id: string;
  name: string;
  component: React.FC<DocEditorProps<unknown, unknown>>;
};

export const TOOLS: Record<string, Tool[]> = {
  essay: [
    {
      id: "essay",
      name: "Editor",
      component: TinyEssayEditor,
    },
  ],
  tldraw: [
    {
      id: "tldraw",
      name: "Drawing",
      component: TLDraw,
    },
  ],
  folder: [
    {
      id: "folder",
      name: "Folder",
      component: FolderViewer,
    },
  ],

  datagrid: [
    {
      id: "datagrid",
      name: "Spreadsheet",
      component: DataGrid,
    },
  ],
  bot: [
    {
      id: "bot",
      name: "Bot",
      component: BotEditor,
    },
  ],
  kanban: [{ id: "kanban", name: "Kanban", component: KanbanBoard }],
};
