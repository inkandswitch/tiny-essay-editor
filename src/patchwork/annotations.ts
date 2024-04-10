import { useState, useMemo } from "react";
import * as A from "@automerge/automerge/next";
import { isEqual, sortBy, min } from "lodash";
import { useStaticCallback } from "@/tee/utils";
import { DocType, docTypes } from "@/DocExplorer/doctypes";
import {
  Annotation,
  HighlightAnnotation,
  AnnotationGroup,
  AnnotationGroupWithState,
  AnnotationWithState,
  DiffWithProvenance,
} from "./schema";
import { HasPatchworkMetadata } from "./schema";

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
  docType,
  diff,
}: {
  doc: A.Doc<HasPatchworkMetadata<unknown, unknown>>;
  docType: DocType;
  diff?: DiffWithProvenance;
}): {
  annotations: AnnotationWithState<unknown, unknown>[];
  annotationGroups: AnnotationGroupWithState<unknown, unknown>[];
  selectedAnchors: unknown[];
  hoveredAnchor: unknown;
  setHoveredAnchor: (anchor: unknown) => void;
  setSelectedAnchors: (anchors: unknown[]) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
  setSelectedAnnotationGroupId: (id: string) => void;
} {
  const [hoveredState, setHoveredState] = useState<HoverState<unknown>>();
  const [selectedState, setSelectedState] = useState<SelectionState<unknown>>();

  const setHoveredAnchor = (anchor: unknown) => {
    setHoveredState({ type: "anchor", anchor });
  };

  const setSelectedAnchors = useStaticCallback((anchors: unknown[]) => {
    if (
      selectedState?.type === "anchors" &&
      isEqual(selectedState.anchors, anchors)
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

  const discussions = useMemo(
    () => (doc?.discussions ? Object.values(doc.discussions) : []),
    [doc]
  );

  const { annotations, annotationGroups } = useMemo(() => {
    if (!doc) {
      return { annotations: [], annotationGroups: [] };
    }

    const patchesToAnnotations = docTypes[docType].patchesToAnnotations;
    const valueOfAnchor = docTypes[docType].valueOfAnchor ?? (() => null);
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
    const claimedAnnotations = new Set<Annotation<unknown, unknown>>();

    discussions.forEach((discussion) => {
      if (discussion.resolved) {
        return;
      }

      // turn anchors of discussion into hightlight annotations
      const discussionHighlightAnnotations: HighlightAnnotation<
        unknown,
        unknown
      >[] = (discussion.target ?? []).flatMap((anchor) => {
        const value = valueOfAnchor(doc, anchor);

        return value !== undefined
          ? [
              {
                type: "highlighted",
                target: anchor,
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
          discussion.target.some((anchor) =>
            doAnchorsOverlap(docType, editAnnotation.target, anchor, doc)
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

    const computedAnnotationGroups: AnnotationGroup<unknown, unknown>[] =
      groupAnnotations(
        docType,
        editAnnotations.filter(
          (annotation) => !claimedAnnotations.has(annotation)
        )
      ).map((annotations) => ({ annotations }));

    const combinedAnnotationGroups = discussionGroups.concat(
      computedAnnotationGroups
    );

    const sortAnchorsBy = docTypes[docType].sortAnchorsBy;

    return {
      annotations: editAnnotations.concat(highlightAnnotations),
      annotationGroups: sortAnchorsBy
        ? sortBy(combinedAnnotationGroups, (annotationGroup) =>
            min(
              annotationGroup.annotations.map((annotation) =>
                sortAnchorsBy(doc, annotation.target)
              )
            )
          )
        : combinedAnnotationGroups,
    };
  }, [doc, discussions, diff]);

  const {
    focusedAnchors,
    focusedAnnotationGroupIds,
    expandedAnnotationGroupId,
  } = useMemo(() => {
    const focusedAnchors = new Set<unknown>();
    const focusedAnnotationGroupIds = new Set<string>();
    let expandedAnnotationGroupId: string;

    switch (selectedState?.type) {
      case "anchors": {
        // focus selected anchors
        selectedState.anchors.forEach((anchor) => focusedAnchors.add(anchor));

        // first annotationGroup that contains all selected anchors is expanded
        const annotationGroup = annotationGroups.find((group) =>
          doesAnnotationGroupContainAnchors(
            docType,
            group,
            selectedState.anchors,
            doc
          )
        );
        if (annotationGroup) {
          expandedAnnotationGroupId = getAnnotationGroupId(annotationGroup);

          // ... the anchors in that group are focused as well
          annotationGroup.annotations.map((annotation) =>
            focusedAnchors.add(annotation.target)
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
            focusedAnchors.add(annotation.target)
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
              docType,
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
            focusedAnchors.add(annotation.target)
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
            focusedAnchors.add(annotation.target)
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
        isFocused: focusedAnchors.has(annotation.target),
      })),
    [annotations, focusedAnchors]
  );

  const annotationGroupsWithState: AnnotationGroupWithState<
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
    hoveredAnchor:
      hoveredState?.type === "anchor" ? hoveredState.anchor : undefined,
    setHoveredAnchor,
    setSelectedAnchors,
    setHoveredAnnotationGroupId,
    setSelectedAnnotationGroupId,
  };
}

export const doAnchorsOverlap = (
  type: DocType,
  a: unknown,
  b: unknown,
  doc: HasPatchworkMetadata<unknown, unknown>
) => {
  const comperator = docTypes[type].doAnchorsOverlap;
  return comperator ? comperator(a, b, doc) : isEqual(a, b);
};

export const areAnchorSelectionsEqual = (
  type: DocType,
  a: unknown[],
  b: unknown[],
  doc: HasPatchworkMetadata<unknown, unknown>
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
  return `${firstAnnotation.type}:${JSON.stringify(firstAnnotation.target)}`;
}

export function doesAnnotationGroupContainAnchors<T, V>(
  docType: DocType,
  group: AnnotationGroup<T, V>,
  anchors: T[],
  doc: HasPatchworkMetadata<T, V>
) {
  return anchors.every((anchor) =>
    group.annotations.some((annotation) =>
      doAnchorsOverlap(docType, annotation.target, anchor, doc)
    )
  );
}

export function groupAnnotations<T, V>(
  docType: DocType,
  annotations: Annotation<T, V>[]
): Annotation<T, V>[][] {
  const grouper =
    docTypes[docType].groupAnnotations ??
    ((annotations: Annotation<T, V>[]) =>
      annotations.map((annotation) => [annotation]));

  return grouper(annotations) as Annotation<T, V>[][];
}
