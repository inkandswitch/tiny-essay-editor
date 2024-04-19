import { EditorView } from "@codemirror/view";

type DragAndDropImagePluginConfig = {
  // onDrop is called whenever an image is dropped into the editor
  // the handle can return a string that will be inserted at the the drop position
  onDrop: (file: File) => Promise<string | undefined>;
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
          onDrop(file).then((text) => {
            console.log("drop", text);

            if (text) {
              const pos = view.posAtCoords({
                x: event.clientX,
                y: event.clientY,
              });

              view.dispatch({
                changes: { from: pos, insert: text },
              });
            }
          });
        } else {
          alert("Only image files are allowed.");
        }
      }
      return true;
    },
  });
};
