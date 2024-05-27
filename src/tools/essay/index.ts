import { Tool } from "@/os/tools";
import { EssayEditor } from './components/EssayEditor.js';
import { EssayAnnotations } from './components/EssayAnnotations.js';

export default {
  id: "essay",
  name: "Editor",
  editorComponent: EssayEditor,
  annotationViewComponent: EssayAnnotations,
} as Tool;
