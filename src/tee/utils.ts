import { next as A } from "@automerge/automerge";
import { EditorView } from "@codemirror/view";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { MarkdownDoc } from "./schema";
// import { getDiffBaseOfDoc } from "@/chronicle/components/EditGroups";
import { AutomergeUrl } from "@automerge/automerge-repo";

// taken from https://www.builder.io/blog/relative-time
/**
 * Convert a date to a relative time string, such as
 * "a minute ago", "in 2 hours", "yesterday", "3 months ago", etc.
 * using Intl.RelativeTimeFormat
 */
export function getRelativeTimeString(
  date: Date | number,
  lang = navigator.language
): string {
  // Allow dates or times to be passed
  const timeMs = typeof date === "number" ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Array reprsenting one minute, hour, day, week, month, etc in seconds
  const cutoffs = [
    60,
    3600,
    86400,
    86400 * 7,
    86400 * 30,
    86400 * 365,
    Infinity,
  ];

  // Array equivalent to the above but in the string representation of the units
  const units: Intl.RelativeTimeFormatUnit[] = [
    "second",
    "minute",
    "hour",
    "day",
    "week",
    "month",
    "year",
  ];

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex(
    (cutoff) => cutoff > Math.abs(deltaSeconds)
  );

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}

export interface ReviewStateFilter {
  self: AutomergeUrl;
  showReviewedBySelf: boolean;
  showReviewedByOthers: boolean;
}

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

export const useStaticCallback = <Params extends any[], Result>(
  callback: (...args: Params) => Result
): ((...args: Params) => Result) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback((...args: Params) => callbackRef.current(...args), []);
};
