import {
  TextAnnotation,
  TextAnnotationForUI,
  TextAnnotationWithPosition,
  MarkdownDoc,
  PatchAnnotation,
  ResolvedEditRange,
  Comment,
} from "./schema";
import { DiffWithProvenance } from "@/patchwork/schema";
import { EditorView } from "@codemirror/view";
import { next as A } from "@automerge/automerge";
import { ReactElement, useEffect, useMemo, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { sortBy } from "lodash";
// import { getDiffBaseOfDoc } from "@/chronicle/components/EditGroups";
import { arraysAreEqual } from "@/DocExplorer/utils";
import { PatchWithAttr } from "@automerge/automerge-wasm";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { TextPatch } from "@/patchwork/utils";

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

  const commentHeights = annotation.comments.map(
    (comment) => 64 + Math.floor(comment.content.length / 60) * 20
  );
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

// Resolve comment thread cursors to integer positions in the document
export const getTextAnnotationsForUI = ({
  doc,
  selectedAnnotationIds,
  diff,
  diffBase,
  showDiff,
  patchAnnotations,
  visibleAuthorsForEdits,
  reviewStateFilter,
}: {
  doc: MarkdownDoc;
  selectedAnnotationIds: string[];
  diff?: DiffWithProvenance;
  diffBase?: A.Heads;
  showDiff: boolean;
  patchAnnotations?: PatchAnnotation[];
  visibleAuthorsForEdits: AutomergeUrl[];
  reviewStateFilter: ReviewStateFilter;
}): TextAnnotationForUI[] => {
  let annotations: TextAnnotation[] = [];

  annotations = [
    ...annotations,
    ...Object.values(doc.commentThreads ?? {}).filter(
      (thread) => !thread.resolved
    ),
  ];

  if (showDiff) {
    // Here we take the persisted drafts and "claim" patches from the current diff
    // into the individual edit ranges. Any patches from the diff that overlap with
    // the edit range on the draft get claimed for that edit range.
    const draftAnnotations = Object.values(doc.drafts ?? {})
      .flatMap((draft) => {
        // filter out drafts that are not based on the current diffBase
        if (diffBase && !arraysAreEqual(draft.fromHeads, diffBase)) {
          return [];
        }

        const editRangesWithComments: Array<{
          editRange: ResolvedEditRange;
          patches: (A.Patch | PatchWithAttr<AutomergeUrl> | TextPatch)[];
          comments: Comment[];
        }> = draft.editRangesWithComments.map((editRange) => {
          const { fromCursor, toCursor } = editRange.editRange;
          const from = A.getCursorPosition(doc, ["content"], fromCursor);
          const to = A.getCursorPosition(doc, ["content"], toCursor);
          const patchesForEditRange =
            diff?.patches.filter((patch) => {
              if (patch.path[0] !== "content") return false;
              if (patch.action === "replace") {
                return doesPatchOverlapWith(patch.raw.splice, from, to);
              }
              return doesPatchOverlapWith(patch, from, to);
            }) ?? [];
          return {
            ...editRange,
            patches: patchesForEditRange,
            editRange: { ...editRange.editRange, from, to },
          };
        });

        const sortedEditRangesWithComments = sortBy(
          editRangesWithComments,
          (range) =>
            A.getCursorPosition(doc, ["content"], range.editRange.fromCursor)
        );
        return [
          {
            ...draft,
            editRangesWithComments: sortedEditRangesWithComments,
          },
        ];
      })
      .filter((draft) => {
        if (draft.reviews) {
          if (
            !reviewStateFilter.showReviewedBySelf &&
            draft.reviews[reviewStateFilter.self]
          ) {
            return false;
          }

          const reviewers = Object.keys(draft.reviews);
          if (
            !reviewStateFilter.showReviewedByOthers &&
            (!reviewStateFilter.showReviewedBySelf ||
              !draft.reviews[reviewStateFilter.self]) &&
            (reviewers.length > 1 ||
              (reviewers.length === 1 &&
                reviewers[0] !== reviewStateFilter.self))
          ) {
            return false;
          }
        }

        return draft.editRangesWithComments
          .flatMap((range) => range.patches)
          .some(
            (patch) =>
              // @ts-expect-error todo look into attributed patch types
              visibleAuthorsForEdits.includes(patch.attr) || !patch.attr
          );
      });

    annotations = [...annotations, ...draftAnnotations];

    annotations = [
      ...annotations,
      ...(patchAnnotations ?? []).filter(
        (annotation) =>
          // @ts-expect-error todo look into types for PatchWithAttr
          visibleAuthorsForEdits.includes(annotation.patch.attr) ||
          // @ts-expect-error todo look into types for PatchWithAttr
          !annotation.patch.attr
      ),
    ];
  }

  return annotations
    .flatMap((annotation) => {
      let from = 0;
      let to = 0;
      try {
        if (annotation.type === "patch" || annotation.type === "thread") {
          from = A.getCursorPosition(doc, ["content"], annotation.fromCursor);
          to = A.getCursorPosition(doc, ["content"], annotation.toCursor);
        } else if (annotation.type === "draft") {
          if (annotation.editRangesWithComments.length === 0) {
            return [];
          }
          // For a draft with multiple patches, position the annotation by the first patch.
          const patchPositions = annotation.editRangesWithComments.map(
            (livePatch) => {
              return {
                from: A.getCursorPosition(
                  doc,
                  ["content"],
                  livePatch.editRange.fromCursor
                ),
                to: A.getCursorPosition(
                  doc,
                  ["content"],
                  livePatch.editRange.toCursor
                ),
              };
            }
          );
          const sortedPatchPositions = patchPositions.sort(
            (a, b) => a.from - b.from
          );
          from = sortedPatchPositions[0].from;
          to = sortedPatchPositions[0].to;
        }
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
          ...annotation,
          from,
          to,
          active: selectedAnnotationIds.includes(annotation.id),
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

// A React hook that gets the annotations for the doc w/ positions
// and manages caching.
// The main thing the hook helps with is figuring out the patch annotations.
export const useAnnotationsWithPositions = ({
  doc,
  view,
  selectedAnnotationIds,
  editorRef,
  diff,
  diffBase,
  visibleAuthorsForEdits,
  reviewStateFilter,
}: {
  doc: MarkdownDoc;
  view: EditorView;
  selectedAnnotationIds: string[];
  editorRef: React.MutableRefObject<HTMLElement | null>;
  diff?: DiffWithProvenance;
  diffBase?: A.Heads;
  visibleAuthorsForEdits: AutomergeUrl[];
  reviewStateFilter: ReviewStateFilter;
}) => {
  // We first get integer positions for each thread and cache that.
  const threads = useMemo(() => {
    if (!doc) return [];

    /** Create some virtual inferred threads based on the diff,
     *  for patches which haven't been manually stored yet
     */
    const patchAnnotations = (diff?.patches ?? []).flatMap(
      (patch): PatchAnnotation[] => {
        if (
          patch.path[0] !== "content" ||
          !["splice", "del", "replace"].includes(patch.action)
        )
          return [];

        let patchStart, patchEnd;

        switch (patch.action) {
          case "splice":
            patchStart = patch.path[1] as number;
            patchEnd = Math.min(
              (patch.path[1] as number) + patch.value.length,
              doc.content.length - 1
            );
            break;
          case "del":
            patchStart = patch.path[1] as number;
            patchEnd = (patch.path[1] as number) + 1;
            break;
          case "replace":
            (patchStart = patch.path[1] as number),
              (patchEnd = Math.min(
                (patch.path[1] as number) + patch.new.length,
                doc.content.length - 1
              ));

            break;
          default:
            throw new Error("invalid patch");
        }

        try {
          const fromCursor = A.getCursor(doc, ["content"], patchStart);
          const toCursor = A.getCursor(doc, ["content"], patchEnd);
          const patchId = `${patch.action}-${fromCursor}`;
          return [
            {
              type: "patch",
              // Experimenting with stable IDs for patches...
              // ID a patch by its action + its from cursor? this feels not unique enough...
              id: patchId,
              fromCursor,
              toCursor,
              patch,
              fromHeads: diff.fromHeads,
              toHeads: diff.toHeads,
            },
          ];
        } catch (e) {
          console.warn("Failed to get cursor for patch", e);
          return [];
        }
      }
    );

    const docRangesClaimedByDrafts = Object.values(doc.drafts ?? {})
      .flatMap((draft) =>
        draft.editRangesWithComments.map((editRange) => editRange.editRange)
      )
      .map((range) => ({
        from: A.getCursorPosition(doc, ["content"], range.fromCursor),
        to: A.getCursorPosition(doc, ["content"], range.toCursor),
      }));

    // don't show a patch if it overlaps with a draft
    const patchAnnotationsToShow = patchAnnotations.filter((annotation) => {
      // This is a bit roundabout. We could have gotten this from the original patch in this case...
      // But it feels safer to just always use annotation cursors, because in the general case
      // patch indexes aren't usable (in case the patch is from a stale diff)
      const from = A.getCursorPosition(doc, ["content"], annotation.fromCursor);
      const to = A.getCursorPosition(doc, ["content"], annotation.toCursor);

      const patchOverlapsWithDraft = docRangesClaimedByDrafts.some(
        (draftRange) => from <= draftRange.to && to >= draftRange.from
      );

      return !patchOverlapsWithDraft;
    });

    return getTextAnnotationsForUI({
      doc,
      diffBase,
      selectedAnnotationIds,
      patchAnnotations: patchAnnotationsToShow,
      diff,
      showDiff: diff !== undefined,
      visibleAuthorsForEdits,
      reviewStateFilter,
    });
  }, [
    doc,
    selectedAnnotationIds,
    diff,
    visibleAuthorsForEdits,
    diffBase,
    reviewStateFilter,
  ]);

  // Next we get the vertical position for each thread.

  // It may be inefficient to rerender comments sidebar on each scroll but
  // it's fine for now and it lets us reposition comments as the user scrolls.
  // (Notably we're not repositioning comments in JS at 60fps;
  // we just use CodeMirror to compute position, and it doesn't tell us position
  // of comments that are way off-screen. That's why we need this scroll handler
  // to catch when things come near the screen)
  const scrollPosition = useScrollPosition(editorRef);

  const threadsWithPositions = useMemo(
    () => {
      if (!doc) return [];
      return view
        ? getVisibleTheadsWithPos({
            threads,
            doc,
            view,
            selectedAnnotationIds,
          })
        : [];
    },

    // the scrollPosition dependency is implicit so the linter thinks it's not needed;
    // but actually it's critical for making comments appear correctly as scrolling happens
    [doc, view, threads, selectedAnnotationIds, scrollPosition]
  );

  return threadsWithPositions;
};
