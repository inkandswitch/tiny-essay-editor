import { EditorView, ViewPlugin } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

type DragAndDropImagePluginConfig = {
  // createImageReference is called whenever an image is dropped into the editor
  // the handle can return a string that will be inserted at the the drop position
  createImageReference: (file: File) => Promise<string | undefined>;
};

export const dragAndDropImagesPlugin = ({
  createImageReference,
}: DragAndDropImagePluginConfig) => {
  let view: EditorView;

  let previousSelection: EditorSelection;

  const onDragEnter = (event) => {
    previousSelection = view.state.selection;

    event.preventDefault(); // cancel event to indicate drag is allowed
    event.dataTransfer.dropEffect = "copy"; // Show a visual cue that a copy operation is happening
  };

  const onDragOver = (event) => {
    event.preventDefault(); // cancel event to indicate drag is allowed
  };

  const onDrop = (event) => {
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        createImageReference(file).then((text) => {
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
  };

  return ViewPlugin.fromClass(
    class {
      constructor(v: EditorView) {
        view = v;

        // For some reason if we use the the EditorView.domEventHandlers api the drop events
        // get swallowed by the tree component. If we register the event handlers directly it works.
        //
        // There is an open issue that react-aborist doesn't play nicely with drag and drop
        // handling outside of the library: https://github.com/brimdata/react-arborist/issues/239
        view.dom.addEventListener("dragenter", onDragEnter);
        view.dom.addEventListener("dragover", onDragOver);
        view.dom.addEventListener("drop", onDrop);
      }

      destroy() {
        view.dom.removeEventListener("dragenter", onDragEnter);
        view.dom.removeEventListener("dragover", onDragOver);
        view.dom.removeEventListener("drop", onDrop);
      }
    }
  );
};
