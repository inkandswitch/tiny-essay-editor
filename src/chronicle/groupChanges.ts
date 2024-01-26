import { DiffWithProvenance, MarkdownDoc, Tag } from "@/tee/schema";
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
import { diffWithProvenanceAndAttribution } from "./utils";

type GenericChangeGroup = {
  id: string;
  changes: DecodedChange[];
  actorIds: ActorId[];
  authorUrls: AutomergeUrl[];
  // TODO make this a generic type
  docAtEndOfChangeGroup: Doc<MarkdownDoc>;
  diff: DiffWithProvenance;
  tags: Tag[];
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
  newChange: DecodedChange,
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
    return currentGroup.authorUrls.includes(newChange.metadata?.author);
  },
  ByNumberOfChanges: (
    currentGroup: ChangeGroup,
    newChange: DecodedChange,
    batchSize: number
  ) => {
    return currentGroup.changes.length < batchSize;
  },
  ByCharCount: (
    currentGroup: ChangeGroup,
    newChange: DecodedChange,
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
    tags,
  }: {
    algorithm: keyof typeof GROUPINGS;
    numericParameter: number;
    tags: Tag[];
  } = {
    algorithm: "ByActorAndNumChanges",
    /** Some algorithms have a numeric parameter like batch size that the user can control */
    numericParameter: 100,
    tags: [],
  }
) => {
  const changes = getAllChanges(doc);
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  const pushCurrentGroup = () => {
    const diffHeads =
      changeGroups.length > 0 ? [changeGroups[changeGroups.length - 1].id] : [];
    currentGroup.diff = diffWithProvenanceAndAttribution(doc, diffHeads, [
      currentGroup.id,
    ]);

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
    let decodedChange = decodeChange(change);

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
        !currentGroup.authorUrls.includes(decodedChange.metadata.author)
      ) {
        currentGroup.authorUrls.push(decodedChange.metadata.author);
      }

      // If this change is tagged, then we should end the current group.
      // This ensures we have a group boundary corresponding to the tag in the changelog.
      // TODO: The comparison here seems a little iffy; we're comparing heads to a single change hash...
      if (tags.find((tag) => tag.heads[0] === decodedChange.hash)) {
        currentGroup.tags = tags.filter(
          (tag) => tag.heads[0] === decodedChange.hash
        );
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
          return op.action === "set" && op.insert === true ? total + 1 : total;
        }, 0),
        charsDeleted: decodedChange.ops.reduce((total, op) => {
          return op.action === "del" ? total + 1 : total;
        }, 0),
        commentsAdded: 0,
        diff: { patches: [], fromHeads: [], toHeads: [] },
        tags: [],
        time:
          decodedChange.time && decodedChange.time > 0
            ? decodedChange.time
            : undefined,
        authorUrls: decodedChange.metadata?.author
          ? [decodedChange.metadata.author]
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

export const extractHeadings = (
  doc: MarkdownDoc,
  patches: Patch[]
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
        patchStart = patch.path[1];
        patchEnd = patchStart + patch.length;
        break;
      }
      case "splice": {
        patchStart = patch.path[1];
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
  patches: Patch[];
};

// This is a quick hacky grouping
// Probably better to iterate over patches rather than groups..?
const groupPatchesByDelimiter =
  (delimiter: string) =>
  (doc: MarkdownDoc, patches: Patch[]): PatchGroup[] => {
    if (!doc?.content) return [];
    const patchGroups: PatchGroup[] = [];

    let currentGroup: PatchGroup | null = null;

    const createNewGroupFromPatch = (patch: Patch) => {
      const patchStart = patch.path[1];
      const patchEnd = patchStart + (patch.value?.length || patch.length);
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

      const patchStart = patch.path[1];
      const patchEnd = patchStart + (patch.value?.length || patch.length);

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

export const groupPatchesByLine = groupPatchesByDelimiter("\n");
export const groupPatchesByParagraph = groupPatchesByDelimiter("\n\n");
