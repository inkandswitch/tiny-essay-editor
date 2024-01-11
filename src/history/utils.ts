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
import { isValidAutomergeUrl } from "@automerge/automerge-repo/dist/AutomergeUrl";
import { AutomergeUrl } from "@automerge/automerge-repo/dist/types";

export type ChangeGroup = {
  id: string;
  changes: DecodedChange[];
  actorIds: ActorId[];
  authorsContactUrls?: AutomergeUrl[];
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
  doc: Doc<MarkdownDoc>,
  algorithm: keyof typeof GROUPINGS = "ActorAndMaxSize"
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

    if (currentGroup && GROUPINGS[algorithm](currentGroup, decodedChange)) {
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

      const authorContactUrl = getAuthorContactUrl(decodedChange);

      console.log("parse", decodedChange, authorContactUrl);

      currentGroup = {
        // the "ID" is the hash of the latest change in the group.
        // TODO: revisit whether this makes sense as an identifier for the group?
        // It's a bit dangerous to store this separately from the changes since they
        // might get out of sync, but it's super convenient in the view...
        id: decodedChange.hash,
        changes: [decodedChange],
        actorIds: [decodedChange.actor],
        authorsContactUrls: authorContactUrl ? [authorContactUrl] : undefined,
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

  // we want the latest group at the top
  changeGroups.reverse();

  return changeGroups;
};

function getAuthorContactUrl(change: DecodedChange): AutomergeUrl | undefined {
  if (!change.message) {
    return;
  }

  try {
    const { author } = JSON.parse(change.message);
    if (author && isValidAutomergeUrl(author)) {
      return author;
    }
  } catch (e) {
    return undefined;
  }
}
