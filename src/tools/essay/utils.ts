import { EditorView } from "@codemirror/view";
import { next as A } from "@automerge/automerge";
import { ReactElement, useMemo } from "react";
import ReactDOMServer from "react-dom/server";
import { AnnotationGroupWithUIState } from "@/os/versionControl/schema";
import { MarkdownDoc, MarkdownDocAnchor } from "@/datatypes/essay";
import { useScrollPosition } from "@/os/hooks/useScrollPosition";

export type AnnotationGroupWithPosition = AnnotationGroupWithUIState<
  MarkdownDocAnchor,
  string
> & {
  yCoord: number;
};

// a very rough approximation; needs to be better but being perfect seems hard
const estimatedHeightOfAnnotationGroup = (
  annotationGroup: AnnotationGroupWithUIState<MarkdownDocAnchor, string>
) => {
  const commentHeights = annotationGroup.discussion
    ? annotationGroup.discussion.comments.map(
        (comment) => 64 + Math.floor(comment.content.length / 60) * 20
      )
    : [];
  const commentsHeight = commentHeights.reduce((a, b) => a + b, 0);
  const PADDING = 24;
  const BUTTONS = 0;
  const actionButtonsHeight = annotationGroup.state === "expanded" ? 50 : 0;
  return PADDING + BUTTONS + commentsHeight + 20 + actionButtonsHeight;
};

// Given a list of comment threads, find a vertical position for each comment.
// We roughly try to put the comments vertically near the text they are commenting on.
// But we also avoid overlapping comments by bumping them up or down if they overlap.
// The currently active comment gets priority for being nearby its text;
// other comments bump up or down from that point.
export const getVisibleAnnotationGroupsWithPos = ({
  doc,
  editorView,
  annotationGroups,
}: {
  annotationGroups: AnnotationGroupWithUIState<MarkdownDocAnchor, string>[];
  doc: MarkdownDoc;
  editorView: EditorView;
}): AnnotationGroupWithPosition[] => {
  // As an initial draft, put each thread right next to its comment
  const annotationGroupsWithPosition: AnnotationGroupWithPosition[] =
    annotationGroups.flatMap((annotationGroup) => {
      const topOfEditor =
        editorView?.scrollDOM.getBoundingClientRect()?.top ?? 0;
      const position = Math.min(
        ...annotationGroup.annotations.map((annotation) =>
          A.getCursorPosition(doc, ["content"], annotation.anchor.fromCursor)
        )
      );
      const viewportCoordsOfAnnotationGroup =
        editorView?.coordsAtPos(position)?.top;
      if (viewportCoordsOfAnnotationGroup === undefined) {
        return [];
      }

      const TOP_MARGIN = 40;
      const yCoord =
        -1 * topOfEditor + viewportCoordsOfAnnotationGroup + TOP_MARGIN - 16;

      return [
        {
          ...annotationGroup,
          yCoord,
        },
      ];
    });

  // Now it's possible that we have annotation groups which are overlapping one another.
  // Make a best effort to mostly avoid overlaps.

  let activeIndex = annotationGroupsWithPosition.findIndex(
    (annotation) => annotation.state === "expanded"
  );
  if (activeIndex === -1) activeIndex = 0;

  // Iterate upwards
  for (let i = activeIndex - 1; i >= 0; i--) {
    if (
      annotationGroupsWithPosition[i].yCoord +
        estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i]) >
      annotationGroupsWithPosition[i + 1].yCoord
    ) {
      annotationGroupsWithPosition[i].yCoord =
        annotationGroupsWithPosition[i + 1].yCoord -
        estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i]);
    }
  }

  // Iterate downwards
  for (let i = activeIndex + 1; i < annotationGroupsWithPosition.length; i++) {
    if (
      annotationGroupsWithPosition[i].yCoord <
      annotationGroupsWithPosition[i - 1].yCoord +
        estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i - 1])
    ) {
      annotationGroupsWithPosition[i].yCoord =
        annotationGroupsWithPosition[i - 1].yCoord +
        estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i - 1]);
    }
  }

  for (let i = 1; i < annotationGroupsWithPosition.length; i++) {
    if (
      annotationGroupsWithPosition[i].yCoord <
      annotationGroupsWithPosition[i - 1].yCoord +
        estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i - 1])
    ) {
      if (i === activeIndex) {
        annotationGroupsWithPosition[i - 1].yCoord =
          annotationGroupsWithPosition[i].yCoord -
          estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i - 1]);
      } else {
        annotationGroupsWithPosition[i].yCoord =
          annotationGroupsWithPosition[i - 1].yCoord +
          estimatedHeightOfAnnotationGroup(annotationGroupsWithPosition[i - 1]);
      }
    }
  }

  return annotationGroupsWithPosition;
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
export const useAnnotationGroupsWithPosition = ({
  annotationGroups,
  doc,
  editorView,
  editorContainer,
}: {
  annotationGroups: AnnotationGroupWithUIState<MarkdownDocAnchor, string>[];
  doc: MarkdownDoc;
  editorView: EditorView;
  editorContainer: HTMLElement;
}): AnnotationGroupWithPosition[] => {
  // Next we get the vertical position for each thread.

  // It may be inefficient to rerender comments sidebar on each scroll but
  // it's fine for now and it lets us reposition comments as the user scrolls.
  // (Notably we're not repositioning comments in JS at 60fps;
  // we just use CodeMirror to compute position, and it doesn't tell us position
  // of comments that are way off-screen. That's why we need this scroll handler
  // to catch when things come near the screen)
  const scrollPosition = useScrollPosition(editorContainer);

  const annotationGroupsWithPositions = useMemo(() => {
    return editorView
      ? getVisibleAnnotationGroupsWithPos({
          editorView,
          doc,
          annotationGroups,
        })
      : [];

    // the scrollPosition dependency is implicit so the linter thinks it's not needed;
    // but actually it's critical for making comments appear correctly as scrolling happens
  }, [editorView, annotationGroups, scrollPosition]);

  return annotationGroupsWithPositions;
};
