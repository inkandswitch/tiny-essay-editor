import { Tool } from "@/os/tools";
import { EssayEditor } from "./components/EssayEditor";
import { EssayAnnotations } from "./components/EssayAnnotations";
import { markdownDataType } from "./datatype";

export const essayEditorTool: Tool = {
  type: "patchwork:tool",
  name: "Editor",
  supportedDataTypes: [markdownDataType],
  editorComponent: EssayEditor,
  annotationsViewComponent: EssayAnnotations,
  supportsInlineComments: true,
};
