import { CopyableMarkdownDoc } from "@/tee/schema";
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
  ActorAndMaxSize: (currentGroup: ChangeGroup, newChange: DecodedChange) => {
    return (
      currentGroup.actorIds[0] === newChange.actor &&
      currentGroup.changes.length < 1000
    );
  },
  ConsecutiveRunByActor: (
    currentGroup: ChangeGroup,
    newChange: DecodedChange
  ) => {
    return currentGroup.actorIds[0] === newChange.actor;
  },
  Batch500: (currentGroup: ChangeGroup) => {
    return currentGroup.changes.length < 500;
  },
  Batch100: (currentGroup: ChangeGroup) => {
    return currentGroup.changes.length < 100;
  },

  // Other groupings to try:
  // - time based sessions
  // - use a manual grouping persisted somewhere?
  // - nonlinear: group by actor, out of this sorted order of changes
};

/* returns all the changes from this doc, grouped in a simple way for now. */
export const getGroupedChanges = (
  doc: Doc<CopyableMarkdownDoc>,
  options: {
    algorithm: keyof typeof GROUPINGS;
    start?: string;
    end?: string;
  }
) => {
  const changes = getAllChanges(doc);
  const decodedChanges = changes.map((change) => decodeChange(change));
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  const pushCurrentGroup = () => {
    const diffHeads =
      changeGroups.length > 0 ? [changeGroups[changeGroups.length - 1].id] : [];
    currentGroup.diff = diff(doc, diffHeads, [currentGroup.id]);
    changeGroups.push(currentGroup);
  };

  let startIndex = 0;
  if (options.start) {
    const indexOfChange = decodedChanges.findIndex(
      (change) => change.hash === options.start
    );
    if (indexOfChange === -1) {
      throw new Error(`start change not found: ${options.start}`);
    }
    startIndex = indexOfChange + 1;
  }

  for (let i = startIndex; i < decodedChanges.length; i++) {
    const decodedChange = decodedChanges[i];

    if (
      currentGroup &&
      GROUPINGS[options.algorithm](currentGroup, decodedChange)
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.charsAdded += decodedChange.ops.reduce((total, op) => {
        return op.action === "set" && op.insert === true ? total + 1 : total;
      }, 0);
      currentGroup.charsDeleted += decodedChange.ops.reduce((total, op) => {
        return op.action === "del" ? total + 1 : total;
      }, 0);
      currentGroup.id = decodedChange.hash;
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

    if (options.end && decodedChange.hash === options.end) {
      break;
    }
  }

  if (currentGroup) {
    pushCurrentGroup();
  }

  // we want the latest group at the top
  changeGroups.reverse();

  return changeGroups;
};
