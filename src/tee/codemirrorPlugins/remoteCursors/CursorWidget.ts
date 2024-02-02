import {EditorView, WidgetType} from "@codemirror/view";

export class CursorWidget extends WidgetType {
  element: HTMLElement | null;
  constructor(private user: string, private color: string) {
    super();
  }

  eq(other) {
    return other.user === this.user && other.color === this.color;
  }

  toDOM(view) {
    //const cursorCoords = view.coordsAtPos(cursorPos);

    const element = document.createElement("span");
    element.className = "remote-cursor";
    element.style.borderLeft = `1px solid ${this.color}`;
    
    element.style.borderLeftWidth = '2px';
    element.style.borderLeftStyle = 'solid';
    element.style.marginLeft = element.style.marginRight = '-1px';
    // element.style.height = (cursorCoords.bottom - cursorCoords.top) * 0.9 + 'px';
    element.style.zIndex = "0";

    element.setAttribute("data-user", this.user);
    // Initially hide the user name
    element.setAttribute("data-show-name", "false");
  
    // Trigger the animation by toggling an attribute
    this.showAndHideName(element);

    return element;
  }

  showAndHideName(element) {
    // Reset the animation by removing and re-adding the attribute
    element.setAttribute("data-show-name", "true");
    
    // Use a timeout to hide the name after a brief period
    setTimeout(() => {
      if (element) { // Check if the element still exists
        element.setAttribute("data-show-name", "false");
      }
    }, 1500); // Matches the animation duration
  }

  ignoreEvent() {
    return false;
  }
}


// Define your custom theme extension
export const remoteCursorTheme = EditorView.theme({
  ".cm-editor .remote-cursor[data-show-name='true']::after": {
    content: "attr(data-user)",
    position: "absolute",
    left: "0",
    top: "-1.5em",
    backgroundColor: "#fff",
    padding: "2px 4px",
    borderRadius: "4px",
    fontSize: "0.75em",
    opacity: "1", // Show the name initially
    animation: "cm6CursorFadeOut 1.5s ease-out forwards"
  },
}, {dark: false /* or true if it's a dark theme */});

// Define the fadeOut animation globally, as it can't be included directly in the theme
const globalStyles = `
@keyframes cm6CursorFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    visibility: hidden;
  }
}
`;

// Inject the global styles into the document head
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = globalStyles;
document.head.appendChild(styleSheet);