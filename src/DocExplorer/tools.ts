import React from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";
import { FolderViewer } from "@/folders/components/FolderViewer";

export type Tool = {
  id: string;
  name: string;
  component: React.FC;
};

export const TOOLS = {
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
  /*  folder: [
    {
      id: "folder",
      name: "Folder",
      component: FolderViewer,
    },
  ], */
};
