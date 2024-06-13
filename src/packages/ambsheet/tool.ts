import { Tool } from "@/os/tools";
import { ambSheetDatatype } from "./datatype";
import { AmbSheet } from "./components/AmbSheet";

export const ambSheetTool: Tool = {
  type: "patchwork:tool",
  id: "ambsheet",
  name: "AmbSheet",
  editorComponent: AmbSheet,
  supportedDataTypes: [ambSheetDatatype],
};
