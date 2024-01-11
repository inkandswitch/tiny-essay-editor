import { MarkdownDoc } from "@/tee/schema";
import {
  Doc,
  diff,
  decodeChange,
  ActorId,
  DecodedChange,
  Patch,
  getAllChanges,
} from "@automerge/automerge";

export type ChangeGroup = {
  id: string;
  changes: DecodedChange[];
  actorIds: ActorId[];
  charsAdded: number;
  charsDeleted: number;
  diff: Patch[];
};

export const GROUPINGS = {
  ByActorAndNumChanges: (
    currentGroup: ChangeGroup,
    newChange: DecodedChange,
    batchSize: number
  ) => {
    return (
      currentGroup.actorIds[0] === newChange.actor &&
      currentGroup.changes.length < batchSize
    );
  },
  ByActor: (currentGroup: ChangeGroup, newChange: DecodedChange) => {
    return currentGroup.actorIds[0] === newChange.actor;
  },
  ByNumberOfChanges: (
    currentGroup: ChangeGroup,
    newChange: DecodedChange,
    batchSize: number
  ) => {
    return currentGroup.changes.length < batchSize;
  },

  // Other groupings to try:
  // - time based sessions
  // - use a manual grouping persisted somewhere?
  // - nonlinear: group by actor, out of this sorted order of changes
};

export const GROUPINGS_THAT_NEED_BATCH_SIZE = [
  "ByActorAndNumChanges",
  "ByNumberOfChanges",
];

/* returns all the changes from this doc, grouped in a simple way for now. */
export const getGroupedChanges = (
  doc: Doc<MarkdownDoc>,
  options: {
    algorithm: keyof typeof GROUPINGS;
    batchSize: number;
  } = {
    algorithm: "ByActorAndNumChanges",
    batchSize: 100,
  }
) => {
  const changes = getAllChanges(doc);
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  const pushCurrentGroup = () => {
    const diffHeads =
      changeGroups.length > 0 ? [changeGroups[changeGroups.length - 1].id] : [];
    currentGroup.diff = diff(doc, diffHeads, [currentGroup.id]);
    changeGroups.push(currentGroup);
  };

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const decodedChange = decodeChange(change);

    if (
      currentGroup &&
      GROUPINGS[options.algorithm](
        currentGroup,
        decodedChange,
        options.batchSize
      )
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.charsAdded += decodedChange.ops.reduce((total, op) => {
        return op.action === "set" && op.insert === true ? total + 1 : total;
      }, 0);
      currentGroup.charsDeleted += decodedChange.ops.reduce((total, op) => {
        return op.action === "del" ? total + 1 : total;
      }, 0);
      currentGroup.id = decodedChange.hash;
      if (!currentGroup.actorIds.includes(decodedChange.actor)) {
        currentGroup.actorIds.push(decodedChange.actor);
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
        diff: [],
      };
    }
  }

  if (currentGroup) {
    pushCurrentGroup();
  }

  return { changeGroups, changeCount: changes.length };
};
