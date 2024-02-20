import {EditorView, WidgetType} from "@codemirror/view";

export class CursorWidget extends WidgetType {
  element: HTMLElement | null;
  timer: NodeJS.Timeout;

  constructor(private user: string, private color: string) {
    super();
  }

  eq(other) {
    return other.user === this.user && other.color === this.color;
  }

  toDOM(view: EditorView) {
    //const cursorCoords = view.coordsAtPos(cursorPos);
    console.log(view)


    this.element = document.createElement("span");
    this.element.className = "remote-cursor";
    this.element.style.setProperty("--user-name", `"${this.user}"`);
    this.element.style.setProperty("--user-color", this.color);

    // Initially show the user name
    this.element.setAttribute("data-show-name", "true");
  
    // Trigger the animation by toggling an attribute
    this.showAndHideName(this.element);

    return this.element;
  }

  showAndHideName(element) {
    // Reset the animation by removing and re-adding the attribute
    element.setAttribute("data-show-name", "true");
    // Use a timeout to hide the name after a brief period
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (element) { // Check if the element still exists
        element.setAttribute("data-show-name", "false");
    }}, 1500); // Matches the animation duration
  }

  ignoreEvent() {
    return false;
  }
}

