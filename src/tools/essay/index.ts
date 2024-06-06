import { Tool } from "@/os/tools";
import { EssayEditor } from "./components/EssayEditor";
import { EssayAnnotations } from "./components/EssayAnnotations";

export default {
  id: "essay",
  name: "Editor",
  editorComponent: EssayEditor,
  annotationViewComponent: EssayAnnotations,
  supportsInlineComments: true,
} as Tool;
