// This version of dropCursor is a copied from https://github.com/codemirror/view/blob/main/src/dropcursor.ts
// We need our own copy to register drag and drop event handlers in a way that doesn't get intercepted by react-dnd
// todo: delete this once we've removed react-dnd as a dependency

import { StateField, StateEffect, Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

interface MeasureRequest<T> {
  /// Called in a DOM read phase to gather information that requires
  /// DOM layout. Should _not_ mutate the document.
  read(view: EditorView): T;
  /// Called in a DOM write phase to update the document. Should _not_
  /// do anything that triggers DOM layout.
  write?(measure: T, view: EditorView): void;
  /// When multiple requests with the same key are scheduled, only the
  /// last one will actually be run.
  key?: any;
}

const setDropCursorPos = StateEffect.define<number | null>({
  map(pos, mapping) {
    return pos == null ? null : mapping.mapPos(pos);
  },
});

const dropCursorPos = StateField.define<number | null>({
  create() {
    return null;
  },
  update(pos, tr) {
    if (pos != null) pos = tr.changes.mapPos(pos);
    return tr.effects.reduce(
      (pos, e) => (e.is(setDropCursorPos) ? e.value : pos),
      pos
    );
  },
});

const drawDropCursor = ViewPlugin.fromClass(
  class {
    cursor: HTMLElement | null = null;
    measureReq: MeasureRequest<{
      left: number;
      top: number;
      height: number;
    } | null>;

    constructor(readonly view: EditorView) {
      this.measureReq = {
        read: this.readPos.bind(this),
        write: this.drawCursor.bind(this),
      };

      this.onDragOver = this.onDragOver.bind(this);
      this.onDragLeave = this.onDragLeave.bind(this);
      this.onDragEnd = this.onDragEnd.bind(this);
      this.onDrop = this.onDrop.bind(this);

      // instead of relying on codemirrors event handling system we register the event handlers directly on the dom element
      view.dom.addEventListener("dragover", this.onDragOver);
      view.dom.addEventListener("dragenter", this.onDragLeave);
      view.dom.addEventListener("dragenter", this.onDragEnd);
      view.dom.addEventListener("drop", this.onDrop);
    }

    private onDragOver(event: DragEvent) {
      this.setDropPos(
        this.view.posAtCoords({ x: event.clientX, y: event.clientY })
      );
    }

    private onDragLeave(event: DragEvent) {
      if (
        event.target == this.view.contentDOM ||
        !this.view.contentDOM.contains(event.relatedTarget as HTMLElement)
      )
        this.setDropPos(null);
    }

    private onDragEnd(event: DragEvent) {
      this.setDropPos(null);
    }

    private onDrop(event: DragEvent) {
      this.setDropPos(null);
    }

    update(update: ViewUpdate) {
      let cursorPos = update.state.field(dropCursorPos);
      if (cursorPos == null) {
        if (this.cursor != null) {
          this.cursor?.remove();
          this.cursor = null;
        }
      } else {
        if (!this.cursor) {
          this.cursor = this.view.scrollDOM.appendChild(
            document.createElement("div")
          );
          this.cursor!.className = "cm-dropCursor";
        }
        if (
          update.startState.field(dropCursorPos) != cursorPos ||
          update.docChanged ||
          update.geometryChanged
        )
          this.view.requestMeasure(this.measureReq);
      }
    }

    readPos(): { left: number; top: number; height: number } | null {
      let { view } = this;
      let pos = view.state.field(dropCursorPos);
      let rect = pos != null && view.coordsAtPos(pos);
      if (!rect) return null;
      let outer = view.scrollDOM.getBoundingClientRect();
      return {
        left: rect.left - outer.left + view.scrollDOM.scrollLeft * view.scaleX,
        top: rect.top - outer.top + view.scrollDOM.scrollTop * view.scaleY,
        height: rect.bottom - rect.top,
      };
    }

    drawCursor(pos: { left: number; top: number; height: number } | null) {
      if (this.cursor) {
        let { scaleX, scaleY } = this.view;
        if (pos) {
          this.cursor.style.left = pos.left / scaleX + "px";
          this.cursor.style.top = pos.top / scaleY + "px";
          this.cursor.style.height = pos.height / scaleY + "px";
        } else {
          this.cursor.style.left = "-100000px";
        }
      }
    }

    destroy() {
      if (this.cursor) this.cursor.remove();

      // unregister manually adedd event handlers
      this.view.dom.removeEventListener("dragover", this.onDragOver);
      this.view.dom.removeEventListener("dragenter", this.onDragLeave);
      this.view.dom.removeEventListener("dragenter", this.onDragEnd);
      this.view.dom.removeEventListener("drop", this.onDrop);
    }

    setDropPos(pos: number | null) {
      if (this.view.state.field(dropCursorPos) != pos)
        this.view.dispatch({ effects: setDropCursorPos.of(pos) });
    }
  }
);

/// Draws a cursor at the current drop position when something is
/// dragged over the editor.
export function dropCursor(): Extension {
  return [dropCursorPos, drawDropCursor];
}
