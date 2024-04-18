import { EditorView } from "@codemirror/view";

type DragAndDropImagePluginConfig = {
  onDrop: (file: File) => void;
};

export const dragAndDropImagesPlugin = ({
  onDrop,
}: DragAndDropImagePluginConfig) => {
  return EditorView.domEventHandlers({
    dragover(event) {
      event.preventDefault(); // Necessary to allow the drop
      event.dataTransfer.dropEffect = "copy"; // Show a visual cue that a copy operation is happening
      return true;
    },
    dragenter(event) {
      event.preventDefault(); // This event must also be canceled to indicate that the drop is allowed
      return true;
    },
    drop(event, view) {
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          // Create a Markdown image link
          const markdownImageText = `![${file.name}](${file.name})`;
          view.dispatch({
            changes: { from: pos, insert: markdownImageText },
          });

          onDrop(file);
        } else {
          alert("Only image files are allowed.");
        }
      }
      return true;
    },
  });
};
