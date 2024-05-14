import * as A from "@automerge/automerge/next";
import { ReactElement, useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MarkdownDoc } from "./schema";

export const isMarkdownDoc = (doc: A.Doc<unknown>): doc is MarkdownDoc => {
  const typedDoc = doc as MarkdownDoc;
  return typeof typedDoc.content === "string";
};

export const useScrollPosition = (container: HTMLElement | null) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (!container) {
      return;
    }
    const updatePosition = () => {
      setScrollPosition(container.scrollTop);
    };
    container.addEventListener("scroll", () => updatePosition());
    updatePosition();
    return () => container.removeEventListener("scroll", updatePosition);
  }, [container]);

  return scrollPosition;
};

// Utils for converting back and forth between CodeMirror and Automerge ranges.
// The end of a Codemirror range can be an index past the last character in the
// document, but we can't get an Automerge cursor for that position.
// TODO: understand and document this more thoroughly

export const cmRangeToAMRange = (range: { from: number; to: number }) => ({
  from: range.from,
  to: range.to - 1,
});

export const amRangeToCMRange = (range: { from: number; to: number }) => ({
  from: range.from,
  to: range.to + 1,
});

// Helper for making HTML Elements in codemirror editor
export const jsxToHtmlElement = (jsx: ReactElement): HTMLElement => {
  const htmlString = ReactDOMServer.renderToStaticMarkup(jsx);
  const div = document.createElement("div");
  div.innerHTML = htmlString;
  return div.firstElementChild as HTMLElement;
};
