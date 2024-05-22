import { useState, useMemo } from "react";
import * as A from "@automerge/automerge/next";
import { isEqual, sortBy, min } from "lodash";
import { useStaticCallback } from "@/os/hooks/useStaticCallback";
import { DatatypeId, DATA_TYPES } from "@/os/datatypes";
import {
  Annotation,
  HighlightAnnotation,
  AnnotationGroup,
  AnnotationGroupWithUIState,
  AnnotationWithUIState,
  DiffWithProvenance,
  CommentEditingState,
} from "./schema";
import { HasVersionControlMetadata } from "./schema";

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

export function useAnnotations({
  doc,
  datatypeId,
  diff,
  isCommentInputFocused,
}: {
  doc: A.Doc<HasVersionControlMetadata<unknown, unknown>>;
  datatypeId: DatatypeId;
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
  editComment: (commentId: string) => void;
} {
  const [commmentIdBeingEdited, setCommentIdBeingEdited] = useState<string>();
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
    if (!doc) {
      return { annotations: [], annotationGroups: [] };
    }

    const patchesToAnnotations = DATA_TYPES[datatypeId].patchesToAnnotations;
    const valueOfAnchor = DATA_TYPES[datatypeId].valueOfAnchor ?? (() => null);
    const discussions = Object.values(doc?.discussions ?? []);

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

    discussions.forEach((discussion) => {
      if (discussion.resolved) {
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

      // ingore discussions without highlight annotations
      // this can happen if the values that where referenced by a discussion have since been deleted
      if (discussionHighlightAnnotations.length === 0) {
        return;
      }

      highlightAnnotations.push(...discussionHighlightAnnotations);

      const overlappingAnnotations = [];

      editAnnotations.forEach((editAnnotation) => {
        if (
          discussion.anchors.some((anchor) =>
            doAnchorsOverlap(datatypeId, editAnnotation.anchor, anchor, doc)
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
        discussion,
      });
    });

    const computedAnnotationGroups: AnnotationGroup<unknown, unknown>[] =
      groupAnnotations(
        datatypeId,
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

    const sortAnchorsBy = DATA_TYPES[datatypeId].sortAnchorsBy;
    const sortedAnnotationGroups = sortAnchorsBy
      ? sortBy(combinedAnnotationGroups, (annotationGroup) =>
          min(
            annotationGroup.annotations.map((annotation) =>
              sortAnchorsBy(doc, annotation.anchor)
            )
          )
        )
      : combinedAnnotationGroups;

    return {
      annotations: editAnnotations.concat(highlightAnnotations),
      annotationGroups: discussionsWithoutAnchors
        .map(
          (discussion) =>
            ({
              discussion,
              annotations: [],
            } as AnnotationGroup<unknown, unknown>)
        )
        .concat(sortedAnnotationGroups),
    };
  }, [
    doc,
    diff,
    selectedState,
    isCommentInputFocused,
    datatypeId,
    discussionsWithoutAnchors,
  ]);

  const {
    selectedAnchors,
    hoveredAnchors,
    selectedAnnotationGroupIds,
    expandedAnnotationGroupId,
  } = useMemo(() => {
    const selectedAnchors = new Set<unknown>();
    const hoveredAnchors = new Set<unknown>();
    const selectedAnnotationGroupIds = new Set<string>();
    let expandedAnnotationGroupId: string;

    // Record selection state for anchors and annotation groups
    switch (selectedState?.type) {
      case "anchors": {
        // focus selected anchors
        selectedState.anchors.forEach((anchor) => selectedAnchors.add(anchor));

        // first annotationGroup that contains all selected anchors is expanded
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(
            datatypeId,
            group,
            selectedState.anchors,
            doc
          )
        );
        if (annotationGroup) {
          expandedAnnotationGroupId = getAnnotationGroupId(annotationGroup);

          // ... the anchors in that group are focused as well
          annotationGroup.annotations.forEach((annotation) =>
            selectedAnchors.add(annotation.anchor)
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
            selectedAnchors.add(annotation.anchor)
          );
        }
        break;
      }
    }

    // Record hovered state for anchors
    switch (hoveredState?.type) {
      case "anchor": {
        // focus hovered anchor
        hoveredAnchors.add(hoveredState.anchor);

        // find first discussion that contains the hovered anchor and hover all anchors that are part of that discussion as wellp
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(
            datatypeId,
            group,
            [hoveredState.anchor],
            doc
          )
        );

        if (annotationGroup) {
          annotationGroup.annotations.forEach(({ anchor }) =>
            hoveredAnchors.add(anchor)
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
            hoveredAnchors.add(annotation.anchor)
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
            selectedAnchors.has(annotation.anchor) ||
            hoveredAnchors.has(annotation.anchor),

          // Selected annotations should be scrolled into view
          shouldBeVisibleInViewport: selectedAnchors.has(annotation.anchor),
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

        return {
          ...annotationGroup,
          state:
            expandedAnnotationGroupId === id
              ? "expanded"
              : selectedAnnotationGroupIds.has(id)
              ? "focused"
              : "neutral",
          comment:
            commmentIdBeingEdited &&
            annotationGroup.discussion.comments.some(
              (comment) => comment.id === commmentIdBeingEdited
            )
              ? { type: "edit", commentId: commmentIdBeingEdited }
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
    editComment: setCommentIdBeingEdited,
  };
}

export const doAnchorsOverlap = (
  type: DatatypeId,
  a: unknown,
  b: unknown,
  doc: HasVersionControlMetadata<unknown, unknown>
) => {
  const comperator = DATA_TYPES[type].doAnchorsOverlap;
  return comperator ? comperator(doc, a, b) : isEqual(a, b);
};

export const areAnchorSelectionsEqual = (
  type: DatatypeId,
  a: unknown[],
  b: unknown[],
  doc: HasVersionControlMetadata<unknown, unknown>
) => {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((anchor) =>
    b.some((other) => doAnchorsOverlap(type, anchor, other, doc))
  );
};

export function getAnnotationGroupId<T, V>(
  annotationGroup: AnnotationGroup<T, V>
) {
  if (annotationGroup.discussion) return annotationGroup.discussion.id;

  // if the annotation group has no discussion we know that it's a computed annotation group
  // which means that the annotation doesn't appear in any other annotationGroup
  // so we can just pick the first annotation to generate a unique id
  const firstAnnotation = annotationGroup.annotations[0];
  return `${firstAnnotation.type}:${JSON.stringify(firstAnnotation.anchor)}`;
}

export function doesAnnotationGroupContainAnchors<T, V>(
  datatypeId: DatatypeId,
  group: AnnotationGroup<T, V>,
  anchors: T[],
  doc: HasVersionControlMetadata<T, V>
) {
  return anchors.every((anchor) =>
    group.annotations.some((annotation) =>
      doAnchorsOverlap(datatypeId, annotation.anchor, anchor, doc)
    )
  );
}

export function groupAnnotations<T, V>(
  datatypeId: DatatypeId,
  annotations: Annotation<T, V>[]
): Annotation<T, V>[][] {
  const grouper =
    DATA_TYPES[datatypeId].groupAnnotations ??
    ((annotations: Annotation<T, V>[]) =>
      annotations.map((annotation) => [annotation]));

  return grouper(annotations) as Annotation<T, V>[][];
}
