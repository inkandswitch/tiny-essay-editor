import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

import { remoteStateField } from "./RemoteCursorsState";

import { UserSelectionData } from ".";

export const collaborativePlugin = (setLocalSelections: (s: UserSelectionData) => void, peerId: string, user: UserMetadata) => ViewPlugin.fromClass(class {
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
    setLocalSelections({peerId, user, selection: {selections, cursor}})
  }
}, {
  decorations: plugin => plugin.view.state.field(remoteStateField)
});

