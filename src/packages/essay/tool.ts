import { Tool } from "@/os/tools";
import { EssayAnnotations } from "./components/EssayAnnotations";
import { EssayEditor } from "./components/EssayEditor";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { MarkdownDoc } from "./datatype";

export const essayEditorTool: Tool = {
  type: "patchwork:tool",
  id: "essay",
  name: "Editor",
  supportedDataTypes: ["essay"],
  editorComponent: EssayEditor,
  annotationsViewComponent: EssayAnnotations,
  supportsInlineComments: true,

  statusBarComponent: ({ docUrl }) => {
    const [doc] = useDocument<MarkdownDoc>(docUrl);

    return `${doc.content.length} characters`;
  },
};
