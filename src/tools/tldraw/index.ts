import { Tool } from "@/os/tools";
import { TLDraw } from "./components/TLDraw";
import { TLDrawAnnotations } from "./components/TLDrawAnnotations";

export default {
  id: "tldraw",
  name: "Drawing",
  editorComponent: TLDraw,
  annotationViewComponent: TLDrawAnnotations,
} as Tool;
