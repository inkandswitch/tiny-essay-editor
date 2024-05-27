import { Tool } from "@/os/tools";
import { TLDraw } from './components/TLDraw.js';
import { TLDrawAnnotations } from './components/TLDrawAnnotations.js';

export default {
  id: "tldraw",
  name: "Drawing",
  editorComponent: TLDraw,
  annotationViewComponent: TLDrawAnnotations,
} as Tool;
