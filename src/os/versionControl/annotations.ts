import { DataType } from "@/os/datatypes";
import { useStaticCallback } from "@/os/hooks/useStaticCallback";
import * as A from "@automerge/automerge/next";
import { isEqual, min, sortBy } from "lodash";
import { useMemo, useState } from "react";
import {
  Annotation,
  AnnotationGroup,
  AnnotationGroupWithUIState,
  AnnotationWithUIState,
  CommentState,
  DiffWithProvenance,
  Discussion,
  HasVersionControlMetadata,
  HighlightAnnotation,
} from "./schema";

type HoverAnchorState<T> = {
  type: "anchor";
  anchor: T;
};

type SelectedAnchorsState<T> = {
  type: "anchors";
  anchors: T[];
};

type ActiveGroupState = {
  type: "annotationGroup";
  id: string;
};

type SelectionState<T> = SelectedAnchorsState<T> | ActiveGroupState;
type HoverState<T> = HoverAnchorState<T> | ActiveGroupState;

type PendingDiscussion<T> = {
  anchors: T[];
};

export function useAnnotations({
  doc,
  dataType,
  diff,
  isCommentInputFocused,
}: {
  doc: A.Doc<HasVersionControlMetadata<unknown, unknown>>;
  dataType: DataType<unknown, unknown, unknown>;
  diff?: DiffWithProvenance;
  isCommentInputFocused: boolean;
}): {
  annotations: AnnotationWithUIState<unknown, unknown>[];
  annotationGroups: AnnotationGroupWithUIState<unknown, unknown>[];
  selectedAnchors: unknown[];
  setHoveredAnchor: (anchor: unknown) => void;
  setSelectedAnchors: (anchors: unknown[]) => void;
  hoveredAnnotationGroupId: string | undefined;
  setHoveredAnnotationGroupId: (id: string) => void;
  setSelectedAnnotationGroupId: (id: string) => void;
  setCommentState: (state: CommentState<unknown>) => void;
} {
  const [commentState, setCommentState] = useState<CommentState<unknown>>();
  const [hoveredState, setHoveredState] = useState<HoverState<unknown>>();
  const [selectedState, setSelectedState] = useState<SelectionState<unknown>>();

  const setHoveredAnchor = useStaticCallback((anchor: unknown) => {
    // ingore set if it doesn't change the current state
    // the document editor might call setHoveredAnchors multiple times, even if it hasn't changed
    if (
      hoveredState?.type === "anchor" &&
      isEqual(hoveredState.anchor, anchor)
    ) {
      return;
    }

    setHoveredState({ type: "anchor", anchor });
  });

  const setSelectedAnchors = useStaticCallback((anchors: unknown[]) => {
    // ingore set if it doesn't change the current state
    // the document editor might call setSelectedAnchors multiple times, even if it hasn't changed
    if (
      (!selectedState && anchors.length === 0) ||
      (selectedState?.type === "anchors" &&
        isEqual(selectedState.anchors, anchors))
    ) {
      return;
    }

    setSelectedState(
      anchors.length > 0 ? { type: "anchors", anchors } : undefined
    );
  });

  const setSelectedAnnotationGroupId = useStaticCallback((id: string) => {
    setSelectedState({ type: "annotationGroup", id });
  });

  const setHoveredAnnotationGroupId = useStaticCallback((id: string) => {
    setHoveredState(
      id !== undefined ? { type: "annotationGroup", id } : undefined
    );
  });

  const hoveredAnnotationGroupId = useMemo(
    () =>
      hoveredState?.type === "annotationGroup" ? hoveredState.id : undefined,
    [hoveredState]
  );

  const discussionsWithoutAnchors = useMemo(
    () =>
      doc?.discussions
        ? Object.values(doc.discussions).filter(
            (discussion) =>
              !discussion.anchors || discussion.anchors.length === 0
          )
        : [],
    [doc]
  );

  const { annotations, annotationGroups } = useMemo(() => {
    if (!doc || !dataType) {
      return { annotations: [], annotationGroups: [] };
    }

    const patchesToAnnotations = dataType.patchesToAnnotations;
    const valueOfAnchor = dataType.valueOfAnchor ?? (() => null);
    const discussions: (PendingDiscussion<unknown> | Discussion<unknown>)[] =
      Object.values(doc?.discussions ?? []);

    const discussionGroups: AnnotationGroup<unknown, unknown>[] = [];
    const highlightAnnotations: HighlightAnnotation<unknown, unknown>[] = [];

    const editAnnotations =
      patchesToAnnotations && diff
        ? patchesToAnnotations(
            doc,
            A.view(doc, diff.fromHeads),
            diff.patches as A.Patch[]
          )
        : [];

    // remember which annotations are part of a discussion
    // these annotations are filtered out and won't be passed to the annotation grouping function
    const claimedAnnotations = new Set<Annotation<unknown, unknown>>();

    // add pending discussion if a new comment is being created on an anchor selection
    // or without a target selection (global comment)
    if (
      commentState?.type === "create" &&
      typeof commentState.target !== "string"
    ) {
      discussions.push({
        anchors: commentState.target,
      });
    }

    discussions.forEach((discussion) => {
      if ("resolved" in discussion && discussion.resolved) {
        return;
      }

      // turn anchors of discussion into highlight annotations
      const discussionHighlightAnnotations: HighlightAnnotation<
        unknown,
        unknown
      >[] = (discussion.anchors ?? []).flatMap((anchor) => {
        const value = valueOfAnchor(doc, anchor);

        return value !== undefined
          ? [
              {
                type: "highlighted",
                anchor,
                value,
              },
            ]
          : [];
      });

      // filter out discussions that have anchors but none of them match a value in the current document
      // this can happen if the values that where referenced by a discussion have since been deleted
      if (
        discussion.anchors &&
        discussion.anchors.length > 0 &&
        discussionHighlightAnnotations.length === 0
      ) {
        return;
      }

      highlightAnnotations.push(...discussionHighlightAnnotations);

      const overlappingAnnotations = [];

      editAnnotations.forEach((editAnnotation) => {
        if (
          discussion.anchors.some((anchor) =>
            doAnchorsOverlap(dataType, editAnnotation.anchor, anchor, doc)
          )
        ) {
          // mark any annotation that is part of a discussion as claimed
          claimedAnnotations.add(editAnnotation);
          overlappingAnnotations.push(editAnnotation);
        }
      });

      discussionGroups.push({
        annotations: discussionHighlightAnnotations.concat(
          overlappingAnnotations
        ),
        discussion: "id" in discussion ? discussion : undefined,
      });
    });

    const computedAnnotationGroups: AnnotationGroup<unknown, unknown>[] =
      groupAnnotations(
        dataType,
        editAnnotations.filter(
          (annotation) => !claimedAnnotations.has(annotation)
        )
      ).map((annotations) => ({ annotations }));

    const combinedAnnotationGroups = discussionGroups.concat(
      computedAnnotationGroups
    );

    // If the comment input is focused, then we highlight the selected anchors
    // which will be the target of the pending comment.
    if (isCommentInputFocused && selectedState?.type === "anchors") {
      const selectionAnnotations = selectedState.anchors.map((anchor) => ({
        type: "highlighted" as const,
        anchor,
        value: null,
      }));

      highlightAnnotations.push(...selectionAnnotations);
    }

    const sortedAnnotationGroups = dataType.sortAnchorsBy
      ? sortBy(combinedAnnotationGroups, (annotationGroup) =>
          annotationGroup.annotations.length === 0
            ? -Infinity // annotation groups without annotations are global comments which are always shown on top
            : min(
                annotationGroup.annotations.map((annotation) =>
                  dataType.sortAnchorsBy(doc, annotation.anchor)
                )
              )
        )
      : combinedAnnotationGroups;

    return {
      annotations: editAnnotations.concat(highlightAnnotations),
      annotationGroups: sortedAnnotationGroups,
    };
  }, [
    doc,
    diff,
    selectedState,
    isCommentInputFocused,
    dataType,
    discussionsWithoutAnchors,
    commentState,
  ]);

  const {
    selectedAnchors,
    hoveredAnchors,
    selectedAnnotationGroupIds,
    expandedAnnotationGroupId,
  } = useMemo(() => {
    const selectedAnchors = new Set<string>();
    const hoveredAnchors = new Set<string>();
    const selectedAnnotationGroupIds = new Set<string>();
    let expandedAnnotationGroupId: string;

    // Record selection state for anchors and annotation groups
    switch (selectedState?.type) {
      case "anchors": {
        // focus selected anchors
        selectedState.anchors.forEach((anchor) =>
          selectedAnchors.add(JSON.stringify(anchor))
        );

        // first annotationGroup that contains all selected anchors is expanded
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(group, selectedState.anchors)
        );
        if (annotationGroup) {
          expandedAnnotationGroupId = getAnnotationGroupId(annotationGroup);

          // ... the anchors in that group are focused as well
          annotationGroup.annotations.forEach((annotation) =>
            selectedAnchors.add(JSON.stringify(annotation.anchor))
          );
        }
        break;
      }

      case "annotationGroup": {
        const annotationGroup = annotationGroups.find(
          (group) => getAnnotationGroupId(group) === selectedState.id
        );

        if (annotationGroup) {
          // expand seleted annotation group
          expandedAnnotationGroupId = selectedState.id;

          // focus all anchors in the annotation group
          annotationGroup.annotations.forEach((annotation) =>
            selectedAnchors.add(JSON.stringify(annotation.anchor))
          );
        }
        break;
      }
    }

    // Record hovered state for anchors
    switch (hoveredState?.type) {
      case "anchor": {
        // focus hovered anchor
        hoveredAnchors.add(JSON.stringify(hoveredState.anchor));

        // find first discussion that contains the hovered anchor and hover all anchors that are part of that discussion as wellp
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(group, [hoveredState.anchor])
        );

        if (annotationGroup) {
          annotationGroup.annotations.forEach(({ anchor }) =>
            hoveredAnchors.add(JSON.stringify(anchor))
          );
        }

        break;
      }

      case "annotationGroup": {
        const annotationGroup = annotationGroups.find(
          (group) => getAnnotationGroupId(group) === hoveredState.id
        );

        if (annotationGroup) {
          // focus all anchors in the annotation groupd
          annotationGroup.annotations.forEach((annotation) =>
            hoveredAnchors.add(JSON.stringify(annotation.anchor))
          );
        }
        break;
      }
    }

    return {
      selectedAnchors,
      hoveredAnchors,
      selectedAnnotationGroupIds,
      expandedAnnotationGroupId,
    };
  }, [hoveredState, selectedState, annotations, annotationGroups]);

  const annotationsWithUIState: AnnotationWithUIState<unknown, unknown>[] =
    useMemo(
      (): AnnotationWithUIState<unknown, unknown>[] =>
        annotations.map((annotation) => ({
          ...annotation,
          // Hovered or selected annotations should be highlighted in the main doc view.
          // todo: In the future we might decide to allow views to distinguish between selected and hovered states,
          // but for now we're keeping it simple and just exposing a single highlighted property.
          isEmphasized:
            selectedAnchors.has(JSON.stringify(annotation.anchor)) ||
            hoveredAnchors.has(JSON.stringify(annotation.anchor)),

          // Selected annotations should be scrolled into view
          shouldBeVisibleInViewport: selectedAnchors.has(
            JSON.stringify(annotation.anchor)
          ),
        })),
      [annotations, selectedAnchors]
    );

  const annotationGroupsWithState: AnnotationGroupWithUIState<
    unknown,
    unknown
  >[] = useMemo(
    () =>
      annotationGroups.map((annotationGroup) => {
        const id = getAnnotationGroupId(annotationGroup);

        let isCommentBeingCreated = false;
        let isCommentBeingEdited = false;

        if (commentState) {
          switch (commentState.type) {
            case "create":
              isCommentBeingCreated =
                // matches target groupId ?
                commentState.target === getAnnotationGroupId(annotationGroup) ||
                // ... or target anchors ?
                (Array.isArray(commentState.target) &&
                  commentState.target.every((anchor, index) =>
                    annotationGroup.annotations.some((annotation) =>
                      isEqual(annotation.anchor, anchor)
                    )
                  ));
              break;
            case "edit":
              isCommentBeingEdited =
                commentState.type === "edit" &&
                annotationGroup.discussion?.comments.some(
                  (comment) => comment.id === commentState.commentId
                );
              break;
          }
        }

        return {
          ...annotationGroup,
          state:
            expandedAnnotationGroupId === id ||
            (!expandedAnnotationGroupId && isCommentBeingCreated)
              ? "expanded"
              : selectedAnnotationGroupIds.has(id)
              ? "focused"
              : "neutral",
          comment: isCommentBeingEdited
            ? commentState
            : isCommentBeingCreated
            ? { type: "create" }
            : undefined,
        };
      }),
    [annotationGroups, expandedAnnotationGroupId, selectedAnnotationGroupIds]
  );

  return {
    annotations: annotationsWithUIState,
    annotationGroups: annotationGroupsWithState,
    selectedAnchors:
      selectedState?.type === "anchors" ? selectedState.anchors : [],
    setHoveredAnchor,
    setSelectedAnchors,
    hoveredAnnotationGroupId,
    setHoveredAnnotationGroupId,
    setSelectedAnnotationGroupId,
    setCommentState,
  };
}

export const doAnchorsOverlap = (
  datatype: DataType<unknown, unknown, unknown>,
  a: unknown,
  b: unknown,
  doc: HasVersionControlMetadata<unknown, unknown>
) => {
  const comperator = datatype.doAnchorsOverlap;
  return comperator ? comperator(doc, a, b) : isEqual(a, b);
};

export const areAnchorSelectionsEqual = (
  datatype: DataType<unknown, unknown, unknown>,
  a: unknown[],
  b: unknown[],
  doc: HasVersionControlMetadata<unknown, unknown>
) => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((anchor) =>
    b.some((other) => doAnchorsOverlap(datatype, anchor, other, doc))
  );
};

export function getAnnotationGroupId<T, V>(
  annotationGroup: AnnotationGroup<T, V>
) {
  if (annotationGroup.discussion) return annotationGroup.discussion.id;

  if (annotationGroup.annotations.length === 0) {
    return undefined;
  }

  // if the annotation group has no discussion we know that it's a computed annotation group
  // which means that the annotation doesn't appear in any other annotationGroup
  // so we can just pick the first annotation to generate a unique id
  const firstAnnotation = annotationGroup.annotations[0];
  return `${firstAnnotation.type}:${JSON.stringify(firstAnnotation.anchor)}`;
}

export function doesAnnotationGroupContainAnchors<T, V>(
  group: AnnotationGroup<T, V>,
  anchors: T[]
) {
  return anchors.every((anchor) =>
    group.annotations.some((annotation) => isEqual(annotation.anchor, anchor))
  );
}

export function groupAnnotations<D, T, V>(
  datatype: DataType<D, T, V>,
  annotations: Annotation<T, V>[]
): Annotation<T, V>[][] {
  const grouper =
    datatype.groupAnnotations ??
    ((annotations: Annotation<T, V>[]) =>
      annotations.map((annotation) => [annotation]));

  return grouper(annotations) as Annotation<T, V>[][];
}
