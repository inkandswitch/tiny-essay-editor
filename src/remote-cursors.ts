import * as cmView from "@codemirror/view";

export const yRemoteSelectionsTheme = cmView.EditorView.baseTheme({});

export class YRemoteCaretWidget extends cmView.WidgetType {
  constructor(private color: string, private name: string) {
    super();
  }

  toDOM() {
    // Create span element
    const span = document.createElement("span");
    span.className = "cm-ySelectionCaret";
    span.style.backgroundColor = this.color;
    span.style.borderColor = this.color;

    // Create first text node
    span.appendChild(document.createTextNode("\u2060"));

    // Create inner div with class 'cm-ySelectionCaretDot'
    const divDot = document.createElement("div");
    divDot.className = "cm-ySelectionCaretDot";
    span.appendChild(divDot);

    // Create word join
    span.appendChild(document.createTextNode("\u2060"));

    // Create another div for 'cm-ySelectionInfo'
    const divInfo = document.createElement("div");
    divInfo.className = "cm-ySelectionInfo";
    divInfo.appendChild(document.createTextNode(this.name));
    span.appendChild(divInfo);

    // Create word join
    span.appendChild(document.createTextNode("\u2060"));

    return span;
  }

  eq(widget) {
    return widget.color === this.color;
  }

  compare(widget) {
    return widget.color === this.color;
  }

  updateDOM() {
    return false;
  }

  get estimatedHeight() {
    return -1;
  }

  ignoreEvent() {
    return true;
  }
}
