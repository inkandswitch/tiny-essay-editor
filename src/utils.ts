import { mapValues } from "lodash";
import { CommentThreadForUI, MarkdownDoc } from "./schema";
import { EditorView } from "@codemirror/view";
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

// a very rough approximation; needs to be better but being perfect seems hard
const estimatedHeightOfThread = (thread: CommentThreadForUI) => {
  const commentHeights = thread.comments.map(
    (comment) => 64 + Math.floor(comment.content.length / 60) * 20
  );
  const commentsHeight = commentHeights.reduce((a, b) => a + b, 0);
  const PADDING = 32;
  const BUTTONS = 40;
  return PADDING + BUTTONS + commentsHeight + 20;
};

// Resolve comment thread cursors to integer positions in the document
export const getThreadsForUI = (
  doc: MarkdownDoc,
  view: EditorView,
  activeThreadId: string | null
): CommentThreadForUI[] => {
  return Object.values(doc.commentThreads ?? {})
    .map((thread) => {
      const from = A.getCursorPosition(doc, ["content"], thread.fromCursor);
      const to = A.getCursorPosition(doc, ["content"], thread.toCursor);
      return {
        ...thread,
        from,
        to,
        active: thread.id === activeThreadId,
      };
    })
    .filter(
      (thread) =>
        !thread.resolved && // hide resolved threads
        thread.to > thread.from // hide threads pointing to deleted text
    );
};

// Calculate a vertical position for each comment.
// We roughly try to put the comments vertically near the text they are commenting on.
// But we also avoid overlapping comments by bumping them up or down if they overlap.
// The currently active comment gets priority for being nearby its text;
// other comments bump up or down from that point.
export const getVisibleTheadsWithPos = (
  doc: MarkdownDoc,
  view: EditorView,
  activeThreadId: string | null
) => {
  // As an initial draft, put each thread right next to its comment
  const draft = getThreadsForUI(doc, view, activeThreadId).flatMap((thread) => {
    const topOfEditor = view?.scrollDOM.getBoundingClientRect()?.top ?? 0;
    const viewportCoordsOfThread = view?.coordsAtPos(
      Math.min(thread.from, doc.content.length - 1)
    )?.top;

    if (viewportCoordsOfThread === undefined) {
      return [];
    }

    const TOP_MARGIN = 80;
    const yCoord = -1 * topOfEditor + viewportCoordsOfThread + TOP_MARGIN;

    return [
      {
        ...thread,

        yCoord,
      },
    ];
  });

  // Sort the draft by vertical position in the doc
  draft.sort((a, b) => a.from - b.from);

  // Now it's possible that we have comments which are overlapping one another.
  // Make a best effort to mostly avoid overlaps.

  let activeIndex = draft.findIndex((thread) => thread.id === activeThreadId);
  if (activeIndex === -1) activeIndex = 0;

  // Iterate upwards
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (
      draft[i].yCoord + estimatedHeightOfThread(draft[i]) >
      draft[i + 1].yCoord
    ) {
      draft[i].yCoord = draft[i + 1].yCoord - estimatedHeightOfThread(draft[i]);
    }
  }

  // Iterate downwards
  for (let i = activeIndex + 1; i < draft.length; i++) {
    if (
      draft[i].yCoord <
      draft[i - 1].yCoord + estimatedHeightOfThread(draft[i - 1])
    ) {
      draft[i].yCoord =
        draft[i - 1].yCoord + estimatedHeightOfThread(draft[i - 1]);
    }
  }

  // console.log("----------");
  for (let i = 1; i < draft.length; i++) {
    if (
      draft[i].yCoord <
      draft[i - 1].yCoord + estimatedHeightOfThread(draft[i - 1])
    ) {
      // console.log(
      //   "collision!",
      //   initialDraft[i].comments[0].content.slice(0, 10),
      //   initialDraft[i].yCoord,
      //   initialDraft[i - 1].comments[0].content.slice(0, 10),
      //   initialDraft[i - 1].yCoord
      // initialDraft[i].yCoord - initialDraft[i - 1].yCoord,
      // veryRoughHeightOfThread(initialDraft[i - 1])
      // );
      if (draft[i].id === activeThreadId) {
        draft[i - 1].yCoord =
          draft[i].yCoord - estimatedHeightOfThread(draft[i - 1]);
      } else {
        draft[i].yCoord =
          draft[i - 1].yCoord + estimatedHeightOfThread(draft[i - 1]);
      }
    }
  }

  return draft;
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
