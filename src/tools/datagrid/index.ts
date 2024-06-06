import { Tool } from "@/os/tools";
import { DataGrid } from "./DataGrid";
import { DataGridAnnotationView } from "./DataGridAnnotationView";

export default {
  id: "datagrid",
  name: "Spreadsheet",
  editorComponent: DataGrid,
  annotationViewComponent: DataGridAnnotationView,
} as Tool;
