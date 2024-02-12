import { MarkdownDoc } from "@/tee/schema";
import { Branch, DiffWithProvenance, Tag } from "./schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  Doc,
  decodeChange,
  ActorId,
  DecodedChange,
  Patch,
  getAllChanges,
  view,
} from "@automerge/automerge/next";
import { TextPatch, diffWithProvenance } from "./utils";
import { ChangeMetadata } from "@automerge/automerge-repo/dist/DocHandle";
import { Heads, PatchWithAttr } from "@automerge/automerge-wasm"; // todo: should be able to import from @automerge/automerge

interface DecodedChangeWithMetadata extends DecodedChange {
  metadata: ChangeMetadata;
}

/** The caller can pass in different kinds  */
export type HeadsMarker = { heads: Heads } & (
  | { type: "tag"; tag: Tag }
  | { type: "mergedBranch"; branch: Branch }
);

type GenericChangeGroup = {
  id: string;
  changes: DecodedChangeWithMetadata[];
  actorIds: ActorId[];
  authorUrls: AutomergeUrl[];
  // TODO make this a generic type
  docAtEndOfChangeGroup: Doc<MarkdownDoc>;
  diff: DiffWithProvenance;
  markers: HeadsMarker[];
  time?: number;
};

type TEEChangeGroup = {
  charsAdded: number;
  charsDeleted: number;
  headings: Heading[];
  commentsAdded: number;
};

export type ChangeGroup = GenericChangeGroup & TEEChangeGroup;

type GroupingAlgorithm = (
  currentGroup: ChangeGroup,
  newChange: DecodedChangeWithMetadata,
  numericParameter: number
) => boolean;

export const GROUPINGS: { [key in string]: GroupingAlgorithm } = {
  ByActorAndNumChanges: (currentGroup, newChange, batchSize) => {
    return (
      currentGroup.actorIds[0] === newChange.actor &&
      currentGroup.changes.length < batchSize
    );
  },
  ByActor: (currentGroup, newChange) => {
    return currentGroup.actorIds[0] === newChange.actor;
  },
  ByAuthor: (currentGroup, newChange) => {
    if (!newChange.metadata?.author) {
      return true;
    }
    return currentGroup.authorUrls.includes(
      newChange.metadata?.author as AutomergeUrl
    );
  },
  ByNumberOfChanges: (
    currentGroup: ChangeGroup,
    newChange: DecodedChangeWithMetadata,
    batchSize: number
  ) => {
    return currentGroup.changes.length < batchSize;
  },
  ByCharCount: (
    currentGroup: ChangeGroup,
    newChange: DecodedChangeWithMetadata,
    batchSize: number
  ) => {
    return currentGroup.charsAdded + currentGroup.charsDeleted < batchSize;
  },

  // This always combines everything into one group,
  // so we only end up splitting when there's a manual tag
  ByTagsOnly: () => true,

  // "batch size" param here means "max gap allowed, in ms"
  //
  ByEditTime: (currentGroup, newChange, maxGapInMinutes) => {
    if (
      (newChange.time === undefined || newChange.time === 0) &&
      (currentGroup.time === undefined || currentGroup.time === 0)
    ) {
      return true;
    }

    return newChange.time < currentGroup.time + maxGapInMinutes * 60 * 1000;
  },

  // Other groupings to try:
  // - time based sessions
  // - use a manual grouping persisted somewhere?
  // - nonlinear: group by actor, out of this sorted order of changes
};

export const GROUPINGS_THAT_TAKE_BATCH_SIZE: Array<keyof typeof GROUPINGS> = [
  "ByActorAndNumChanges",
  "ByNumberOfChanges",
  "ByCharCount",
];

export const GROUPINGS_THAT_TAKE_GAP_TIME: Array<keyof typeof GROUPINGS> = [
  "ByEditTime",
];

/* returns all the changes from this doc, grouped in a simple way for now. */
export const getGroupedChanges = (
  doc: Doc<MarkdownDoc>,
  {
    algorithm,
    numericParameter,
    markers,
  }: {
    algorithm: keyof typeof GROUPINGS;
    numericParameter: number;
    markers: HeadsMarker[];
  } = {
    algorithm: "ByActorAndNumChanges",
    /** Some algorithms have a numeric parameter like batch size that the user can control */
    numericParameter: 100,
    markers: [],
  }
) => {
  const changes = getAllChanges(doc);
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  const pushCurrentGroup = () => {
    const diffHeads =
      changeGroups.length > 0 ? [changeGroups[changeGroups.length - 1].id] : [];
    currentGroup.diff = diffWithProvenance(doc, diffHeads, [currentGroup.id]);

    // Finalize the stats on the group based on the diff

    currentGroup.charsAdded = currentGroup.diff.patches.reduce(
      (total, patch) => {
        if (patch.path[0] !== "content") {
          return total;
        }
        if (patch.action === "splice") {
          return total + patch.value.length;
        } else {
          return total;
        }
      },
      0
    );

    currentGroup.charsDeleted = currentGroup.diff.patches.reduce(
      (total, patch) => {
        if (patch.path[0] !== "content") {
          return total;
        }
        if (patch.action === "del") {
          return total + patch.length;
        } else {
          return total;
        }
      },
      0
    );

    currentGroup.commentsAdded = currentGroup.diff.patches.reduce(
      (total, patch) => {
        const isNewComment =
          patch.path[0] === "commentThreads" &&
          patch.path.length === 4 &&
          patch.action === "insert";

        if (!isNewComment) {
          return total;
        } else {
          return total + 1;
        }
      },
      0
    );

    // GL 1/19: For now, only show a group if it edited the text or added a comment.
    // THIS IS A HACK, revisit this logic and think about it more carefully!
    if (
      currentGroup.charsAdded === 0 &&
      currentGroup.charsDeleted === 0 &&
      currentGroup.commentsAdded === 0
    ) {
      return;
    }

    currentGroup.docAtEndOfChangeGroup = view(doc, [currentGroup.id]);
    currentGroup.headings = extractHeadings(
      currentGroup.docAtEndOfChangeGroup,
      currentGroup.diff.patches
    );
    changeGroups.push(currentGroup);
  };

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    let decodedChange = decodeChange(change) as DecodedChangeWithMetadata;
    decodedChange.metadata = {};

    try {
      const metadata = JSON.parse(decodedChange.message);
      decodedChange = { ...decodedChange, metadata };
    } catch (e) {}

    // Choose whether to add this change to the existing group or start a new group depending on the algorithm.
    if (
      currentGroup &&
      GROUPINGS[algorithm](currentGroup, decodedChange, numericParameter)
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.id = decodedChange.hash;
      if (decodedChange.time && decodedChange.time > 0) {
        currentGroup.time = decodedChange.time;
      }
      if (!currentGroup.actorIds.includes(decodedChange.actor)) {
        currentGroup.actorIds.push(decodedChange.actor);
      }
      if (
        decodedChange.metadata?.author &&
        !currentGroup.authorUrls.includes(
          decodedChange.metadata.author as AutomergeUrl
        )
      ) {
        currentGroup.authorUrls.push(
          decodedChange.metadata.author as AutomergeUrl
        );
      }

      // If this change is tagged, then we should end the current group.
      // This ensures we have a group boundary corresponding to the tag in the changelog.
      // TODO: The comparison here seems a little iffy; we're comparing heads to a single change hash...
      // how should this actually work?
      const matchingMarkers = markers.filter(
        (marker) => marker.heads[0] === decodedChange.hash
      );
      if (matchingMarkers.length > 0) {
        currentGroup.markers = matchingMarkers;
        pushCurrentGroup();
        currentGroup = null;
      }
    } else {
      if (currentGroup) {
        pushCurrentGroup();
      }
      currentGroup = {
        // the "ID" is the hash of the latest change in the group.
        // TODO: revisit whether this makes sense as an identifier for the group?
        // It's a bit dangerous to store this separately from the changes since they
        // might get out of sync, but it's super convenient in the view...
        id: decodedChange.hash,
        changes: [decodedChange],
        actorIds: [decodedChange.actor],
        charsAdded: decodedChange.ops.reduce((total, op) => {
          // @ts-ignore
          return op.action === "set" && op.insert === true ? total + 1 : total;
        }, 0),
        charsDeleted: decodedChange.ops.reduce((total, op) => {
          return op.action === "del" ? total + 1 : total;
        }, 0),
        commentsAdded: 0,
        diff: { patches: [], fromHeads: [], toHeads: [] },
        markers: [],
        time:
          decodedChange.time && decodedChange.time > 0
            ? decodedChange.time
            : undefined,
        authorUrls: decodedChange.metadata?.author
          ? [decodedChange.metadata.author as AutomergeUrl]
          : [],
        docAtEndOfChangeGroup: undefined, // We'll fill this in when we finalize the group
        headings: [],
      };
    }
  }

  if (currentGroup) {
    pushCurrentGroup();
  }

  return { changeGroups, changeCount: changes.length };
};

export type Heading = {
  index: number;
  text: string;
  patches: Patch[];
};

// todo: doesn't handle replace
export const extractHeadings = (
  doc: MarkdownDoc,
  patches: (Patch | TextPatch)[]
): Heading[] => {
  const headingData: Heading[] = [];
  const regex = /^##\s(.*)/gm;
  let match;

  while ((match = regex.exec(doc.content)) != null) {
    headingData.push({ index: match.index, text: match[1], patches: [] });
  }

  for (const patch of patches) {
    if (
      patch.path[0] !== "content" ||
      !["splice", "del"].includes(patch.action)
    ) {
      continue;
    }
    let patchStart: number, patchEnd: number;
    switch (patch.action) {
      case "del": {
        patchStart = patch.path[1] as number;
        patchEnd = patchStart + patch.length;
        break;
      }
      case "splice": {
        patchStart = patch.path[1] as number;
        patchEnd = patchStart + patch.value.length;
        break;
      }
      default: {
        continue;
      }
    }

    // The heading was edited if it overlaps with the patch.
    for (let i = 0; i < headingData.length; i++) {
      const heading = headingData[i];
      if (heading.index >= patchStart && heading.index <= patchEnd) {
        heading.patches.push(patch);
      }
      if (
        heading.index < patchStart &&
        headingData[i + 1]?.index > patchStart
      ) {
        heading.patches.push(patch);
      }
    }
  }

  return headingData;
};

export const charsAddedAndDeletedByPatches = (
  patches: Patch[]
): { charsAdded: number; charsDeleted: number } => {
  return patches.reduce(
    (acc, patch) => {
      if (patch.action === "splice") {
        acc.charsAdded += patch.value.length;
      } else if (patch.action === "del") {
        acc.charsDeleted += patch.length;
      }
      return acc;
    },
    { charsAdded: 0, charsDeleted: 0 }
  );
};

type PatchGroup = {
  groupStartIndex: number;
  groupEndIndex: number;
  patches: (Patch | TextPatch)[];
};

// This is a quick hacky grouping
// Probably better to iterate over patches rather than groups..?
const groupPatchesByDelimiter =
  (delimiter: string) =>
  (doc: MarkdownDoc, patches: (Patch | TextPatch)[]): PatchGroup[] => {
    if (!doc?.content) return [];
    const patchGroups: PatchGroup[] = [];

    let currentGroup: PatchGroup | null = null;

    const createNewGroupFromPatch = (patch: Patch | TextPatch) => {
      const patchStart = patch.path[1] as number;
      const patchEnd = patchStart + getSizeOfPatch(patch);
      const groupStartIndex =
        doc.content.lastIndexOf(delimiter, patchStart) + 1;
      const groupEndIndex = doc.content.indexOf(delimiter, patchEnd);
      return {
        groupStartIndex: groupStartIndex >= 0 ? groupStartIndex : patchStart,
        groupEndIndex: groupEndIndex >= 0 ? groupEndIndex : patchEnd,
        patches: [patch],
      };
    };

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (
        patch.path[0] !== "content" ||
        !["splice", "del"].includes(patch.action)
      ) {
        continue;
      }

      const patchStart = patch.path[1] as number;
      const patchEnd = patchStart + getSizeOfPatch(patch);

      if (currentGroup) {
        if (patchStart <= currentGroup.groupEndIndex) {
          currentGroup.patches.push(patch);
          if (patchEnd > currentGroup.groupEndIndex) {
            currentGroup.groupEndIndex = patchEnd;
          }
        } else {
          patchGroups.push(currentGroup);
          currentGroup = createNewGroupFromPatch(patch);
        }
      } else {
        currentGroup = createNewGroupFromPatch(patch);
      }
    }

    if (currentGroup) {
      patchGroups.push(currentGroup);
    }

    return patchGroups;
  };

const getSizeOfPatch = (patch: Patch | TextPatch): number => {
  switch (patch.action) {
    case "del":
      return patch.length;
    case "splice":
      return patch.value.length;
    default:
      throw new Error("unsupported patch type");
  }
};

export const getAttrOfPatch = <T>(
  patch: Patch | PatchWithAttr<T> | TextPatch
): T | undefined => {
  if (patch.action === "replace") {
    return getAttrOfPatch(patch.raw.splice); // todo: this is not correct delete and insert could be from different authors
  }

  return "attr" in patch ? patch.attr : undefined;
};

export const groupPatchesByLine = groupPatchesByDelimiter("\n");
export const groupPatchesByParagraph = groupPatchesByDelimiter("\n\n");
