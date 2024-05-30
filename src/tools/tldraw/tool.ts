import { Tool } from "@/os/tools";
import { TLDraw } from "./components/TLDraw";
import { TLDrawAnnotations } from "./components/TLDrawAnnotations";

export const DrawingTool: Tool = {
  editorComponent: TLDraw,
  annotationViewComponent: TLDrawAnnotations,
};
