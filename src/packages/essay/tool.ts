import { Tool } from "@/os/tools";
import { EssayAnnotations } from "./components/EssayAnnotations";
import { EssayEditor } from "./components/EssayEditor";

export const essayEditorTool: Tool = {
  type: "patchwork:tool",
  id: "essay",
  name: "Editor",
  supportedDataTypes: ["essay"],
  editorComponent: EssayEditor,
  annotationsViewComponent: EssayAnnotations,
  supportsInlineComments: true,
};
