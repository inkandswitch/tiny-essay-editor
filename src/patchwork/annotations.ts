import { useState, useMemo } from "react";
import * as A from "@automerge/automerge/next";
import { isEqual, sortBy, min } from "lodash";
import { useStaticCallback } from "@/tee/utils";
import { DocType, docTypes } from "@/DocExplorer/doctypes";
import {
  Anchor,
  Annotation,
  HighlightAnnotation,
  AnnotationGroup,
  AnnotationGroupWithState,
  AnnotationWithState,
  DiffWithProvenance,
  UnknownAnnotationGroup,
  UnknownAnnotationGroupWithState,
} from "./schema";
import { HasPatchworkMetadata, UnknownPatchworkDoc } from "./schema";
import { ChangeSelector } from "./changeSelectors";

type HoverAnchorState<D, A extends Anchor<D, V>, V> = {
  type: "anchor";
  anchor: A;
};

type SelectedAnchorsState<D, A extends Anchor<D, V>, V> = {
  type: "anchors";
  anchors: A[];
};

type ActiveGroupState = {
  type: "annotationGroup";
  id: string;
};

type SelectionState<D, A extends Anchor<D, V>, V> =
  | SelectedAnchorsState<D, A, V>
  | ActiveGroupState;
type HoverState<D, A extends Anchor<D, V>, V> =
  | HoverAnchorState<D, A, V>
  | ActiveGroupState;

export function useAnnotations({
  doc,
  docType,
  diff,
}: {
  doc: UnknownPatchworkDoc;
  docType: DocType;
  diff?: DiffWithProvenance;
}): {
  annotations: AnnotationWithState<unknown, unknown>[];
  annotationGroups: UnknownAnnotationGroup[];
  selectedAnchors: unknown[];
  setHoveredAnchor: (anchor: unknown) => void;
  setSelectedAnchors: (anchors: unknown[]) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
  setSelectedAnnotationGroupId: (id: string) => void;
} {
  const [hoveredState, setHoveredState] =
    useState<HoverState<unknown, Anchor<unknown, unknown>, unknown>>();
  const [selectedState, setSelectedState] =
    useState<SelectionState<unknown, Anchor<unknown, unknown>, unknown>>();

  const setHoveredAnchor = useStaticCallback(
    (anchor: Anchor<unknown, unknown>) => {
      // ingore set if it doesn't change the current state
      // the document editor might call setHoveredAnchors multiple times, even if it hasn't changed
      if (
        hoveredState?.type === "anchor" &&
        isEqual(hoveredState.anchor, anchor)
      ) {
        return;
      }

      setHoveredState({ type: "anchor", anchor });
    }
  );

  const setSelectedAnchors = useStaticCallback(
    (anchors: Anchor<unknown, unknown>[]) => {
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
    }
  );

  const setSelectedAnnotationGroupId = useStaticCallback((id: string) => {
    setSelectedState({ type: "annotationGroup", id });
  });

  const setHoveredAnnotationGroupId = useStaticCallback((id: string) => {
    setHoveredState(
      id !== undefined ? { type: "annotationGroup", id } : undefined
    );
  });

  const discussions = useMemo(
    () => (doc?.discussions ? Object.values(doc.discussions) : []),
    [doc]
  );

  const { annotations, annotationGroups } = useMemo(() => {
    // todo: investigate why docTypes[docType] is Record<string, any>
    const changeSelector: ChangeSelector<
      unknown,
      Anchor<unknown, unknown>,
      unknown
    > = docTypes[docType].changeSelector;

    if (!doc || !changeSelector) {
      return { annotations: [], annotationGroups: [] };
    }

    const discussions = Object.values(doc?.discussions ?? []);

    const discussionGroups: UnknownAnnotationGroup[] = [];
    const highlightAnnotations: HighlightAnnotation<unknown, unknown>[] = [];

    const editAnnotations = changeSelector.patchesToAnnotations(
      doc,
      A.view(doc, diff.fromHeads),
      diff.patches as A.Patch[]
    );

    // remember which annotations are part of a discussion
    const claimedAnnotations = new Set<Annotation<unknown, unknown>>();

    discussions.forEach((discussion) => {
      const discussionAnchors = discussion.anchors ?? [];

      if (discussion.resolved) {
        return;
      }

      // turn anchors of discussion into hightlight annotations
      const discussionHighlightAnnotations: HighlightAnnotation<
        unknown,
        unknown
      >[] = discussionAnchors.flatMap((anchorJson) => {
        const anchor = changeSelector.anchorFromJson(anchorJson);

        if (!anchor) {
          console.warn("invalid anchor", anchor);
          return [];
        }

        const value = anchor.resolve(doc);
        if (value === undefined) {
          return [];
        }

        return value !== undefined
          ? [
              {
                type: "highlighted",
                anchor,
                value: anchor.resolve(doc),
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
          discussionAnchors.some((anchor) =>
            editAnnotation.anchor.doesOverlap(anchor, doc)
          )
        ) {
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

    const computedAnnotationGroups: UnknownAnnotationGroup[] = groupAnnotations(
      editAnnotations.filter(
        (annotation) => !claimedAnnotations.has(annotation)
      )
    ).map((annotations) => ({ annotations }));

    const combinedAnnotationGroups = discussionGroups.concat(
      computedAnnotationGroups
    );

    return {
      annotations: editAnnotations.concat(highlightAnnotations),
      annotationGroups: sortBy(combinedAnnotationGroups, (annotationGroup) =>
        min(
          annotationGroup.annotations.map((annotation) =>
            annotation.anchor.sortValue()
          )
        )
      ),
    };
  }, [doc, discussions, diff]);

  const {
    focusedAnchors,
    focusedAnnotationGroupIds,
    expandedAnnotationGroupId,
  } = useMemo(() => {
    const focusedAnchors = new Set<Anchor<unknown, unknown>>();
    const focusedAnnotationGroupIds = new Set<string>();
    let expandedAnnotationGroupId: string;

    switch (selectedState?.type) {
      case "anchors": {
        // focus selected anchors
        selectedState.anchors.forEach((anchor) => focusedAnchors.add(anchor));

        // first annotationGroup that contains all selected anchors is expanded
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(group, selectedState.anchors, doc)
        );
        if (annotationGroup) {
          expandedAnnotationGroupId = getAnnotationGroupId(annotationGroup);

          // ... the anchors in that group are focused as well
          annotationGroup.annotations.map((annotation) =>
            focusedAnchors.add(annotation.anchor)
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
            focusedAnchors.add(annotation.anchor)
          );
        }
        break;
      }
    }

    switch (hoveredState?.type) {
      case "anchor": {
        // focus hovered anchor
        focusedAnchors.add(hoveredState.anchor);

        // all annotationGroup that contain hovered anchors are focused
        annotationGroups.forEach((group) => {
          if (
            !doesAnnotationGroupContainAnchors(
              group,
              [hoveredState.anchor],
              doc
            )
          ) {
            return;
          }

          focusedAnnotationGroupIds.add(getAnnotationGroupId(group));

          // ... the anchors in that group are focused as well
          group.annotations.map((annotation) =>
            focusedAnchors.add(annotation.anchor)
          );
        });
        break;
      }

      case "annotationGroup": {
        const annotationGroup = annotationGroups.find(
          (group) => getAnnotationGroupId(group) === hoveredState.id
        );

        if (annotationGroup) {
          // focus hovered annotation group
          focusedAnnotationGroupIds.add(hoveredState.id);

          // focus all anchors in the annotation groupd
          annotationGroup.annotations.forEach((annotation) =>
            focusedAnchors.add(annotation.anchor)
          );
        }
        break;
      }
    }

    return {
      focusedAnchors,
      focusedAnnotationGroupIds,
      expandedAnnotationGroupId,
    };
  }, [hoveredState, selectedState, annotations, annotationGroups]);

  const annotationsWithState: AnnotationWithState<unknown, unknown>[] = useMemo(
    () =>
      annotations.map((annotation) => ({
        ...annotation,
        hasSpotlight: focusedAnchors.has(annotation.anchor),
      })),
    [annotations, focusedAnchors]
  );

  const annotationGroupsWithState: UnknownAnnotationGroupWithState[] = useMemo(
    () =>
      annotationGroups.map((annotationGroup) => {
        const id = getAnnotationGroupId(annotationGroup);
        return {
          ...annotationGroup,
          state:
            expandedAnnotationGroupId === id
              ? "expanded"
              : focusedAnnotationGroupIds.has(id)
              ? "focused"
              : "neutral",
        };
      }),
    [annotationGroups, expandedAnnotationGroupId, focusedAnnotationGroupIds]
  );

  return {
    annotations: annotationsWithState,
    annotationGroups: annotationGroupsWithState,
    selectedAnchors:
      selectedState?.type === "anchors" ? selectedState.anchors : [],
    setHoveredAnchor,
    setSelectedAnchors,
    setHoveredAnnotationGroupId,
    setSelectedAnnotationGroupId,
  };
}

export function getAnnotationGroupId<D, A extends Anchor<D, V>, V>(
  annotationGroup: AnnotationGroup<D, A, V>
) {
  if (annotationGroup.discussion) return annotationGroup.discussion.id;

  // if the annotation group has no discussion we know that it's a computed annotation group
  // which means that the annotation doesn't appear in any other annotationGroup
  // so we can just pick the first annotation to generate a unique id
  const firstAnnotation = annotationGroup.annotations[0];
  return JSON.stringify(firstAnnotation.anchor.toJson());
}

export function doesAnnotationGroupContainAnchors<D, A extends Anchor<D, V>, V>(
  group: AnnotationGroup<D, A, V>,
  anchors: A[],
  doc: D
) {
  return anchors.every((anchor) =>
    group.annotations.some((annotation) =>
      anchor.doesOverlap(annotation.anchor, doc)
    )
  );
}

export function groupAnnotations<D, V>(
  annotations: Annotation<D, V>[]
): Annotation<D, V>[][] {
  // todo: support custom groupings
  return annotations.map((annotation) => [annotation]);
}
