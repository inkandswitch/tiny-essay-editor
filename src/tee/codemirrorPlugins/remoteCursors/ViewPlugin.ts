import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { SelectionData } from ".";

export const collaborativePlugin = (remoteStateField, setLocalSelections: (s: SelectionData) => void) => ViewPlugin.fromClass(class {
  view: EditorView;
  constructor(view: EditorView) {
    this.view = view
    this.emitLocalChanges(view);
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged) {
      this.emitLocalChanges(update.view);
    }
  }

  emitLocalChanges(view: EditorView) {
    const {state} = view;
    const selections = state.selection.ranges.map(r => ({from: r.from, to: r.to}));
    const cursor = state.selection.main.head;
    setLocalSelections({selections, cursor})
  }
}, {
  decorations: plugin => plugin.view.state.field(remoteStateField)
});
