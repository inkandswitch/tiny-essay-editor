import { next as A } from "@automerge/automerge";
import { DataType } from "@/os/datatypes";
import { init as tldrawinit } from "automerge-tldraw";
import { PenLine } from "lucide-react";
import { TLDrawDoc, TLDrawDocAnchor } from "./schema";
import { DecodedChangeWithMetadata } from "@/os/versionControl/groupChanges";
import { pick } from "lodash";
import { TLShape, TLShapeId, createTLStore } from "@tldraw/tldraw";
import {
  Annotation,
  initVersionControlMetadata,
} from "@/os/versionControl/schema";
import { defaultShapeUtils, Editor } from "@tldraw/tldraw";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: TLDrawDoc) => {
  doc.store["page:page"].name = "Copy of " + doc.store["page:page"].name;
};

export const getTitle = async (doc: TLDrawDoc) => {
  return doc.store["page:page"].name || "Drawing";
};

export const setTitle = (doc: any, title: string) => {
  doc.store["page:page"].name = title;
};

export const init = (doc: TLDrawDoc) => {
  tldrawinit(doc);
  doc.store["page:page"].name = "Drawing";

  initVersionControlMetadata(doc);
};

export const includePatchInChangeGroup = (patch: A.Patch) => {
  return patch.path[0] === "store";
};

export const getLLMSummary = (doc: TLDrawDoc) => {
  return Object.values(doc?.store ?? {})
    .flatMap((obj: any) => {
      if (obj.type !== "text") {
        return [];
      }

      return obj.props.text;
    })
    .join("\n");
};

// We filter conservatively with a deny-list because dealing with edits on a nested schema is annoying.
// Would be better to filter with an allow-list but that's tricky with current Automerge APIs.
export const includeChangeInHistory = (doc: TLDrawDoc) => {
  const metadataObjIds = [
    "branchMetadata",
    "tags",
    "diffBase",
    "discussions",
    "changeGroupSummaries",
  ].map((path) => A.getObjectId(doc, path));

  return (decodedChange: DecodedChangeWithMetadata) => {
    return decodedChange.ops.every((op) => !metadataObjIds.includes(op.obj));
  };
};

const promptForAIChangeGroupSummary = ({
  docBefore,
  docAfter,
}: {
  docBefore: TLDrawDoc;
  docAfter: TLDrawDoc;
}) => {
  return `
Below are two versions of a drawing in TLDraw, stored as JSON.
Summarize the changes in this diff in a few words.
Only return a few words, not a full description. No bullet points.

If possible, interpret the shapes in a meaningful semantic way, eg:

drew mockup of simple UI
edited text from "kitchen" to "bathroom"
grew diagram of system architecture

If not, fall back to general visual descriptions:

drew some new rectangles
moved some shapes to the left
deleted shapes from the top-right corner
recolored some shapes from red to blue

## Doc before

${JSON.stringify(pick(docBefore, ["store"]), null, 2)}

## Doc after

${JSON.stringify(pick(docAfter, ["store"]), null, 2)}`;
};

export const patchesToAnnotations = (
  doc: TLDrawDoc,
  docBefore: TLDrawDoc,
  patches: A.Patch[]
) => {
  return patches.flatMap((patch) => {
    if (patch.path.length !== 2 || patch.path[0] !== "store") {
      return [];
    }

    const shapeId: TLShapeId = patch.path[1] as TLShapeId;

    switch (patch.action) {
      case "del":
        return [
          {
            type: "deleted",
            deleted: docBefore.store[shapeId],
            anchor: shapeId,
          } as Annotation<TLDrawDocAnchor, TLShape>,
        ];

      case "put":
        return [
          {
            type: "added",
            added: doc.store[shapeId],
            anchor: shapeId,
          } as Annotation<TLDrawDocAnchor, TLShape>,
        ];

      // todo: support changed
    }

    return [];
  });
};

export const valueOfAnchor = (doc: TLDrawDoc, anchor: TLShapeId): TLShape => {
  return doc.store[anchor] as TLShape;
};

export const sortAnchorsBy = (doc: TLDrawDoc, anchor: TLShapeId): number => {
  const shape = valueOfAnchor(doc, anchor);
  return shape?.y;
};

type OverlapGroup = {
  combinedBounds: Bounds;
  individualBounds: Bounds[];
  annotations: Annotation<TLShapeId, TLShape>[];
};

export const groupAnnotations = (
  annotations: Annotation<TLShapeId, TLShape>[]
): Annotation<TLShapeId, TLShape>[][] => {
  const groups = new Set<OverlapGroup>();

  for (const annotation of annotations) {
    const value = valueOfAnnotation(annotation);
    const bounds = getBounds(value);

    const overlappingGroups = Array.from(groups).filter(
      (group) =>
        doBoundsOverlap(group.combinedBounds, bounds) &&
        group.individualBounds.some((annotationBound) =>
          doBoundsOverlap(annotationBound, bounds)
        )
    );

    if (overlappingGroups.length === 0) {
      groups.add({
        combinedBounds: bounds,
        individualBounds: [bounds],
        annotations: [annotation],
      });
    } else if (overlappingGroups.length === 1) {
      const existingGroup = overlappingGroups[0];
      existingGroup.combinedBounds = unionBounds(
        existingGroup.combinedBounds,
        bounds
      );
      existingGroup.individualBounds.push(bounds);
      existingGroup.annotations.push(annotation);
    } else {
      const mergedGroup: OverlapGroup = {
        combinedBounds: bounds,
        individualBounds: [bounds],
        annotations: [annotation],
      };
      for (const existingGroup of overlappingGroups) {
        groups.delete(existingGroup);
        mergedGroup.combinedBounds = unionBounds(
          mergedGroup.combinedBounds,
          existingGroup.combinedBounds
        );

        mergedGroup.annotations = mergedGroup.annotations.concat(
          existingGroup.annotations
        );
        mergedGroup.individualBounds = mergedGroup.individualBounds.concat(
          existingGroup.individualBounds
        );
      }

      groups.add(mergedGroup);
    }
  }

  return Array.from(groups).map((group) => group.annotations);
};

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function doBoundsOverlap(rectA: Bounds, rectB: Bounds) {
  // rectA and rectB are objects { x, y, w, h }
  // where (x, y) are the coordinates of the top-left corner,
  // w is the width, and h is the height of the rectangle

  // Check if one rectangle is to the left of the other
  if (rectA.x + rectA.w <= rectB.x || rectB.x + rectB.w <= rectA.x) {
    return false;
  }

  // Check if one rectangle is above the other
  if (rectA.y + rectA.h <= rectB.y || rectB.y + rectB.h <= rectA.y) {
    return false;
  }

  // If neither of the above, the rectangles overlap
  return true;
}

function unionBounds(boundsA: Bounds, boundsB: Bounds): Bounds {
  // Calculate the minimum x and y coordinates for the bounding box
  const minX = Math.min(boundsA.x, boundsB.x);
  const minY = Math.min(boundsA.y, boundsB.y);

  // Calculate the maximum x and y coordinates for the bounding box
  const maxX = Math.max(boundsA.x + boundsA.w, boundsB.x + boundsB.w);
  const maxY = Math.max(boundsA.y + boundsA.h, boundsB.y + boundsB.h);

  // The bounding box's width and height
  const width = maxX - minX;
  const height = maxY - minY;

  return { x: minX, y: minY, w: width, h: height };
}

const editor = new Editor({
  store: createTLStore({ shapeUtils: defaultShapeUtils }),
  shapeUtils: defaultShapeUtils,
  tools: [],
  getContainer: () => document.body,
});

const getBounds = (shape: TLShape): Bounds => {
  let geometry;

  // hack: getGeometry throws an error for some shape types because we don't have a proper editor instance here.
  // we just create an empty editor so we can call the getGeometry function
  try {
    geometry = editor.shapeUtils[shape.type].getGeometry(shape);
  } catch (err) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  return {
    x: shape.x,
    y: shape.y,
    w: geometry.bounds.width,
    h: geometry.bounds.height,
  };
};

const valueOfAnnotation = (annotation: Annotation<TLShapeId, TLShape>) => {
  switch (annotation.type) {
    case "added":
      return annotation.added;

    case "changed":
      return annotation.after;

    case "deleted":
      return annotation.deleted;
  }
};

export const TLDrawDatatype: DataType<TLDrawDoc, TLDrawDocAnchor, TLShape> = {
  id: "tldraw",
  name: "Drawing",
  icon: PenLine,
  init,
  getTitle,
  setTitle,
  markCopy,
  includePatchInChangeGroup,
  includeChangeInHistory,
  promptForAIChangeGroupSummary,
  patchesToAnnotations,
  valueOfAnchor,
  sortAnchorsBy,
  groupAnnotations,
};
