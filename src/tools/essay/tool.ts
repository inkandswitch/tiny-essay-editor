import { Tool } from "@/os/tools";
import { EssayEditor } from "./components/EssayEditor";
import { EssayAnnotations } from "./components/EssayAnnotations";

export const EssayEditorTool: Tool = {
  editorComponent: EssayEditor,
  annotationViewComponent: EssayAnnotations,
  supportsInlineComments: true,
} as Tool;
