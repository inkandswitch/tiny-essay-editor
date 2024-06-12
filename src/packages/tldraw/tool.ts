import { Tool } from "@/os/tools";
import { TLDraw } from "./components/TLDraw";
import { TLDrawAnnotations } from "./components/TLDrawAnnotations";
import { tldrawDatatype } from "./datatype";

export const drawingTool: Tool = {
  type: "patchwork:tool",
  name: "Drawing",
  supportedDataTypes: [tldrawDatatype],
  editorComponent: TLDraw,
  annotationsViewComponent: TLDrawAnnotations,
};
