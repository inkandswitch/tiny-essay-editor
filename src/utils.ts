import { mapValues } from "lodash";
import { CommentThreadForUI, MarkdownDoc } from "./schema";
import { EditorView } from "codemirror";
import { next as A } from "@automerge/automerge";
import { useEffect, useState } from "react";

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

export const getCommentThreadsWithPositions = (
  doc: MarkdownDoc,
  view: EditorView
): {
  [key: string]: CommentThreadForUI;
} => {
  // TODO: May need to get fancier here to resolve overlapping comments

  return mapValues(doc.commentThreads ?? {}, (thread) => {
    const from = A.getCursorPosition(doc, ["content"], thread.fromCursor);
    const to = A.getCursorPosition(doc, ["content"], thread.toCursor);
    const topOfEditor = view?.scrollDOM.getBoundingClientRect()?.top ?? 0;
    const viewportCoordsOfThread = view?.coordsAtPos(
      Math.min(from, doc.content.length - 1)
    )?.top;

    let yCoord;
    if (viewportCoordsOfThread !== undefined) {
      yCoord = -1 * topOfEditor + viewportCoordsOfThread + 80; // why 100??
    } else {
      yCoord = null;
    }

    return {
      ...thread,
      from,
      to,
      yCoord,
    };
  });
};

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      setScrollPosition(window.pageYOffset);
    };
    window.addEventListener("scroll", updatePosition);
    updatePosition();
    return () => window.removeEventListener("scroll", updatePosition);
  }, []);

  return scrollPosition;
};

// Utils for converting back and forth between CodeMirror and Automerge ranges
// If we select at the end of the doc, Codemirror returns a "to" which is
// larger than Automerge wants. So we have to subtract one when converting
// to an AM range, and then add it back later

export const cmRangeToAMRange = (range: { from: number; to: number }) => ({
  from: range.from,
  to: range.to - 1,
});

export const amRangeToCMRange = (range: { from: number; to: number }) => ({
  from: range.from,
  to: range.to + 1,
});
