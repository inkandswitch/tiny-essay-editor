import { Tool } from "@/os/tools";
import { TLDraw } from "./components/TLDraw";
import { TLDrawAnnotations } from "./components/TLDrawAnnotations";

export const drawingTool: Tool = {
  type: "patchwork:tool",
  id: "tldraw",
  name: "Drawing",
  supportedDataTypes: ["tldraw"],
  editorComponent: TLDraw,
  annotationsViewComponent: TLDrawAnnotations,
};
