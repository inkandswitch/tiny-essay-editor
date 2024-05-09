import { next as A } from "@automerge/automerge";
import { EditorView } from "@codemirror/view";
import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import {
  MarkdownDoc,
  TextAnnotationForUI,
  TextAnnotationWithPosition,
} from "./schema";
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

// a very rough approximation; needs to be better but being perfect seems hard...
const estimatedHeightOfAnnotation = (annotation: TextAnnotationForUI) => {
  // Patches and drafts are always pretty short in their collapsed form
  if (annotation.type === "patch") {
    if (
      annotation.patch.action === "splice" &&
      annotation.patch.value.length > 20
    ) {
      return 70;
    } else {
      return 40;
    }
  }

  // This is rough! Redo with more accurate math...
  if (annotation.type === "draft" && !annotation.active) {
    let height = 40;
    if (
      annotation.editRangesWithComments[0].editRange.to -
        annotation.editRangesWithComments[0].editRange.from >
      20
    ) {
      height = height + 40;
    }
    if (annotation.comments.length > 0) {
      height = height + 64 + 20;
    }
    if (annotation.comments.length > 1) {
      height = height + 20;
    }
    return height;
  }

  const commentHeights =
    "comments" in annotation
      ? annotation.comments.map(
          (comment) => 64 + Math.floor(comment.content.length / 60) * 20
        )
      : [];
  const commentsHeight = commentHeights.reduce((a, b) => a + b, 0);

  if (annotation.type === "draft") {
    const patchesHeight = annotation.editRangesWithComments
      .map((range) => range.patches.length)
      .reduce((a, b) => a + b * 40, 0);

    return patchesHeight + commentsHeight + 20;
  } else if (annotation.type === "thread") {
    const PADDING = 32;
    const BUTTONS = 40;
    return PADDING + BUTTONS + commentsHeight + 20;
  }
};

function doesPatchOverlapWith(patch: A.Patch, from: number, to: number) {
  if (patch.action === "splice") {
    const patchFrom = patch.path[1] as number;
    const patchTo = (patch.path[1] as number) + patch.value.length;
    return patchFrom < to && patchTo > from;
  } else if (patch.action === "del") {
    const deleteAt = patch.path[1] as number;
    // @paul: I'm not sure if this is correct or if this needs to be fixed somwhere else,
    // but with the old logic deletes where included twice when grouping things
    // old: return from <= deleteAt && to >= deleteAt;
    return from === deleteAt && to === deleteAt + 1;
  } else {
    return false;
  }
}

export interface ReviewStateFilter {
  self: AutomergeUrl;
  showReviewedBySelf: boolean;
  showReviewedByOthers: boolean;
}

// Given a list of comment threads, find a vertical position for each comment.
// We roughly try to put the comments vertically near the text they are commenting on.
// But we also avoid overlapping comments by bumping them up or down if they overlap.
// The currently active comment gets priority for being nearby its text;
// other comments bump up or down from that point.
export const getVisibleTheadsWithPos = ({
  threads,
  doc,
  view,
  selectedAnnotationIds,
}: {
  threads: TextAnnotationForUI[];
  doc: MarkdownDoc;
  view: EditorView;
  selectedAnnotationIds: string[];
}): TextAnnotationWithPosition[] => {
  // Arbitrarily use the first active thread as the "active" thread
  // for the purposes of positioning.
  const activeThreadId = selectedAnnotationIds[0];

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

  // Pick the first active thread we find
  let activeIndex = threadsWithPositions.findIndex(
    (thread) => thread.id === activeThreadId
  );
  if (activeIndex === -1) activeIndex = 0;

  // Iterate upwards
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (
      threadsWithPositions[i].yCoord +
        estimatedHeightOfAnnotation(threadsWithPositions[i]) >
      threadsWithPositions[i + 1].yCoord
    ) {
      threadsWithPositions[i].yCoord =
        threadsWithPositions[i + 1].yCoord -
        estimatedHeightOfAnnotation(threadsWithPositions[i]);
    }
  }

  // Iterate downwards
  for (let i = activeIndex + 1; i < threadsWithPositions.length; i++) {
    if (
      threadsWithPositions[i].yCoord <
      threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfAnnotation(threadsWithPositions[i - 1])
    ) {
      threadsWithPositions[i].yCoord =
        threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfAnnotation(threadsWithPositions[i - 1]);
    }
  }

  for (let i = 1; i < threadsWithPositions.length; i++) {
    if (
      threadsWithPositions[i].yCoord <
      threadsWithPositions[i - 1].yCoord +
        estimatedHeightOfAnnotation(threadsWithPositions[i - 1])
    ) {
      if (threadsWithPositions[i].id === activeThreadId) {
        threadsWithPositions[i - 1].yCoord =
          threadsWithPositions[i].yCoord -
          estimatedHeightOfAnnotation(threadsWithPositions[i - 1]);
      } else {
        threadsWithPositions[i].yCoord =
          threadsWithPositions[i - 1].yCoord +
          estimatedHeightOfAnnotation(threadsWithPositions[i - 1]);
      }
    }
  }

  return threadsWithPositions;
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

export const useStaticCallback = <Params extends any[], Result>(
  callback: (...args: Params) => Result
): ((...args: Params) => Result) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback((...args: Params) => callbackRef.current(...args), []);
};
