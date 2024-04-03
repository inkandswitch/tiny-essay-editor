import {
  CommentThreadForUI,
  CommentThreadWithPosition,
  MarkdownDoc,
} from "./schema";
import { EditorView } from "@codemirror/view";
import { next as A } from "@automerge/automerge";
import { ReactElement, useEffect, useMemo, useState } from "react";
import ReactDOMServer from "react-dom/server";

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
  activeThreadId: string | null
): CommentThreadForUI[] => {
  return Object.values(doc.commentThreads ?? {})
    .filter((thread) => !thread.resolved) // hide resolved threads
    .flatMap((thread) => {
      let from = 0;
      let to = 0;
      try {
        from = A.getCursorPosition(doc, ["content"], thread.fromCursor);
        to = A.getCursorPosition(doc, ["content"], thread.toCursor);
      } catch (e) {
        if (e instanceof RangeError) {
          // If the cursor isn't found in the content string, hide the comment.
          // This does *not* occur if the comment is pointing to deleted text!
          // It only happens if the string at /content has been replaced entirely.
          return [];
        } else {
          throw e;
        }
      }
      return [
        {
          ...thread,
          from,
          to,
          active: thread.id === activeThreadId,
        },
      ];
    })
    .filter(
      (thread) => thread.to > thread.from // hide threads pointing to deleted text
    );
};

// Given a list of comment threads, find a vertical position for each comment.
// We roughly try to put the comments vertically near the text they are commenting on.
// But we also avoid overlapping comments by bumping them up or down if they overlap.
// The currently active comment gets priority for being nearby its text;
// other comments bump up or down from that point.
export const getVisibleTheadsWithPos = ({
  threads,
  doc,
  view,
  activeThreadId,
}: {
  threads: CommentThreadForUI[];
  doc: MarkdownDoc;
  view: EditorView;
  activeThreadId: string | null;
}): CommentThreadWithPosition[] => {
  // As an initial draft, put each thread right next to its comment
  const threadsWithPositions = threads.flatMap((thread) => {
    const topOfEditor = view?.scrollDOM.getBoundingClientRect()?.top ?? 0;
    const viewportCoordsOfThread = view?.coordsAtPos(
      Math.min(thread.from, doc.content.length - 1)
    )?.top;
    if (viewportCoordsOfThread === undefined) {
      return [];
    }

    const TOP_MARGIN = 40;
    const yCoord = -1 * topOfEditor + viewportCoordsOfThread + TOP_MARGIN - 16;

    return [
      {
        ...thread,
        yCoord,
      },
    ];
  });

  // Sort the draft by vertical position in the doc
  threadsWithPositions.sort((a, b) => a.from - b.from);

  // Now it's possible that we have comments which are overlapping one another.
  // Make a best effort to mostly avoid overlaps.

  let activeIndex = threadsWithPositions.findIndex(
    (thread) => thread.id === activeThreadId
  );
  if (activeIndex === -1) activeIndex = 0;

  // Iterate upwards
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (
      threadsWithPositions[i].yCoord +
        estimatedHeightOfThread(threadsWithPositions[i]) >
      threadsWithPositions[i + 1].yCoord
    ) {
      threadsWithPositions[i].yCoord =
        threadsWithPositions[i + 1].yCoord -
        estimatedHeightOfThread(threadsWithPositions[i]);
    }
  }

  // Iterate downwards
  for (let i = activeIndex + 1; i < threadsWithPositions.length; i++) {
    if (
      threadsWithPositions[i].yCoord <
      threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfThread(threadsWithPositions[i - 1])
    ) {
      threadsWithPositions[i].yCoord =
        threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfThread(threadsWithPositions[i - 1]);
    }
  }

  for (let i = 1; i < threadsWithPositions.length; i++) {
    if (
      threadsWithPositions[i].yCoord <
      threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfThread(threadsWithPositions[i - 1])
    ) {
      if (threadsWithPositions[i].id === activeThreadId) {
        threadsWithPositions[i - 1].yCoord =
          threadsWithPositions[i].yCoord -
          estimatedHeightOfThread(threadsWithPositions[i - 1]);
      } else {
        threadsWithPositions[i].yCoord =
          threadsWithPositions[i - 1].yCoord +
          estimatedHeightOfThread(threadsWithPositions[i - 1]);
      }
    }
  }

  return threadsWithPositions;
};

export const useScrollPosition = (
  ref: React.MutableRefObject<HTMLElement | null>
) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const div = ref.current;
    const updatePosition = () => {
      setScrollPosition(div.scrollTop);
    };
    div.addEventListener("scroll", () => updatePosition());
    updatePosition();
    return () => div.removeEventListener("scroll", updatePosition);
  }, [ref, ref.current]);

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

// A React hook that gets the comment threads for the doc w/ positions
// and manages caching.
export const useThreadsWithPositions = ({
  doc,
  view,
  activeThreadId,
  editorRef,
}: {
  doc: MarkdownDoc;
  view: EditorView;
  activeThreadId: string;
  editorRef: React.MutableRefObject<HTMLElement | null>;
}) => {
  // We first get integer positions for each thread and cache that.
  const threads = useMemo(
    () => (doc ? getThreadsForUI(doc, activeThreadId) : []),
    [doc, activeThreadId]
  );

  // Next we get the vertical position for each thread.

  // It may be inefficient to rerender comments sidebar on each scroll but
  // it's fine for now and it lets us reposition comments as the user scrolls.
  // (Notably we're not repositioning comments in JS at 60fps;
  // we just use CodeMirror to compute position, and it doesn't tell us position
  // of comments that are way off-screen. That's why we need this scroll handler
  // to catch when things come near the screen)
  const scrollPosition = useScrollPosition(editorRef);

  const threadsWithPositions = useMemo(
    () =>
      view
        ? getVisibleTheadsWithPos({ threads, doc, view, activeThreadId })
        : [],

    // the scrollPosition dependency is implicit so the linter thinks it's not needed;
    // but actually it's critical for making comments appear correctly as scrolling happens
    [doc, view, activeThreadId, threads, scrollPosition]
  );

  return threadsWithPositions;
};

// Resolve cursor, but instead of throwing an error return null if cursor can't be resolved
export const getCursorPositionSafely = (
  doc: A.Doc<unknown>,
  path: A.Prop[],
  cursor: A.Cursor
): number | null => {
  try {
    return A.getCursorPosition(doc, path, cursor);
  } catch (err) {
    return null;
  }
};

// Get cursor, but instead of throwing an error return null if cursor can't be created
export function getCursorSafely(
  doc: A.Doc<unknown>,
  path: A.Prop[],
  position: number
): A.Cursor | null {
  try {
    return A.getCursor(doc, path, position);
  } catch (err) {
    return null;
  }
}
