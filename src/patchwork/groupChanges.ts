// This file puts changes from a doc into groups for display in the UI.
// There are various algorithms that can govern what makes a group.
// It can accept manual markers to split groups.

// It also calculates some stats for each group, both generic to all docs
// as well as calling out to some datatype-specific summarization.
// (For now, the datatype is fixed to MarkdownDoc, but there is a clear boundary;
// the TEE code defines MarkdownDoc-specific stats.)

// Known issues:
// - getAllChanges returns different orders on different devices;
//   we should define a total order for changes across all devices.

import { MarkdownDoc } from "@/tee/schema";
import {
  Branch,
  Branchable,
  DiffWithProvenance,
  Discussable,
  Discussion,
  Tag,
  Taggable,
} from "./schema";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import {
  Doc,
  decodeChange,
  ActorId,
  DecodedChange,
  getAllChanges,
  view,
  getHeads,
} from "@automerge/automerge/next";
import { diffWithProvenance } from "./utils";
import {
  ChangeMetadata,
  DocHandle,
} from "@automerge/automerge-repo/dist/DocHandle";
import { Change, Hash, Heads } from "@automerge/automerge-wasm"; // todo: should be able to import from @automerge/automerge
import {
  includeChange,
  showChangeGroupInLog,
  statsForChangeGroup,
} from "@/tee/changeGroups";
import { getChangesFromMergedBranch } from "./branches";
import { isEqual, sortBy } from "lodash";

interface DecodedChangeWithMetadata extends DecodedChange {
  metadata: ChangeMetadata;
}

/** A marker of a moment in the doc history associated w/ some heads */
export type HeadsMarker<DocType, Stats> = {
  id: string;
  heads: Heads;
  users: AutomergeUrl[];
  hideHistoryBeforeThis?: boolean;
} & (
  | { type: "tag"; tag: Tag }
  | {
      type: "otherBranchMergedIntoThisDoc";
      branch: Branch;
      changeGroups: ChangeGroup<DocType, Stats>[];
    }
  | { type: "branchCreatedFromThisDoc"; branch: Branch }
  | {
      type: "originOfThisBranch";
      source: Branchable["branchMetadata"]["source"];
      branch: Branch;
    }
  | { type: "discussionThread"; discussion: Discussion }
);

// All ChangelogItems have a unique id, a heads, and some users asociated.
// Then, each type of item has its own unique data associated too.
export type ChangelogItem<DocType, Stats> = {
  id: string;
  heads: Heads;
  users: AutomergeUrl[];
  time: number;
} & (
  | { type: "changeGroup"; changeGroup: ChangeGroup<DocType, Stats> }
  | HeadsMarker<DocType, Stats>
);

/** Change group attributes that could work for any document */
export type ChangeGroup<DocType, Stats> = {
  // Uniquely IDs the changes in this group.
  // (Concretely, we make IDs from heads + to heads, which I think does stably ID changes?)
  id: string;
  from: Hash;
  to: Hash;
  changes: DecodedChangeWithMetadata[];
  actorIds: ActorId[];
  authorUrls: AutomergeUrl[];
  docAtEndOfChangeGroup: Doc<DocType>;
  diff: DiffWithProvenance;
  markers: HeadsMarker<DocType, Stats>[];
  time?: number;
  stats?: Stats;
};

export type GenericChangeGroup = ChangeGroup<unknown, unknown>;

type GroupingAlgorithm<DocType, Stats> = (
  currentGroup: ChangeGroup<DocType, Stats>,
  newChange: DecodedChangeWithMetadata,
  numericParameter: number
) => boolean;

// A grouping algorithm returns a boolean denoting whether the new change should be added to the current group.
// Some of these algorithms rely on MarkdownDoc-specific stats; need to generalize that further.
export const GROUPINGS: {
  [key in string]: GroupingAlgorithm<unknown, unknown>;
} = {
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
  ByNumberOfChanges: (currentGroup, newChange, batchSize: number) => {
    return currentGroup.changes.length < batchSize;
  },

  // todo: add back, it's the only grouping algorithm that's not generic
  /* ByCharCount: (
    currentGroup: ChangeGroup,
    newChange: DecodedChangeWithMetadata,
    batchSize: number
  ) => {
    return currentGroup.charsAdded + currentGroup.charsDeleted < batchSize;
  }, */

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

  ByAuthorOrTime: (currentGroup, newChange, maxGapInMinutes) => {
    const authorMatch =
      !newChange.metadata?.author ||
      currentGroup.authorUrls.includes(
        newChange.metadata?.author as AutomergeUrl
      );
    const timeMatch =
      newChange.time === undefined ||
      newChange.time === 0 ||
      currentGroup.time === undefined ||
      currentGroup.time === 0 ||
      newChange.time < currentGroup.time + maxGapInMinutes * 60 * 1000;
    return authorMatch && timeMatch;
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
  "ByAuthorOrTime",
];

export const getMarkersForDoc = <
  DocType extends Branchable & Taggable & Discussable,
  Stats
>(
  handle: DocHandle<DocType>,
  repo: Repo
): HeadsMarker<DocType, Stats>[] => {
  const doc = handle.docSync();
  if (!doc) return [];
  let markers: HeadsMarker<DocType, Stats>[] = [];

  const discussions = Object.values(doc.discussions ?? {}).map(
    (discussion) => ({
      type: "discussionThread" as const,
      id: `discussion-${discussion.id}`,
      heads: discussion.heads,
      users: discussion.comments
        .map((comment) => comment.contactUrl)
        .filter(Boolean),
      discussion,
    })
  );

  // Sorting by timestamp is a bit bad and not-local-firsty...
  // The problem is that we don't currently store an ordering on
  // discussions, and so we have on way to order discussions at
  // the same heads other than a timestamp.
  // A better solution would be to store an array in Automerge.
  const sortedDiscussions = sortBy(
    discussions,
    (d) => d.discussion.comments[0].timestamp ?? 0
  );

  /** Mark discussion threads */
  markers = markers.concat(sortedDiscussions);

  /** Mark branch merge points */
  markers = markers.concat(
    doc.branchMetadata.branches
      .filter((branch) => branch.mergeMetadata !== undefined)
      .map((branch) => ({
        id: `branch-merge-${branch.mergeMetadata!.mergeHeads[0]}`,
        heads: branch.mergeMetadata!.mergeHeads,
        type: "otherBranchMergedIntoThisDoc",
        users: branch.mergeMetadata!.mergedBy
          ? [branch.mergeMetadata!.mergedBy]
          : [],
        branch,
        changeGroups: [],
      }))
  );

  /** Mark where this branch started */
  if (doc.branchMetadata.source) {
    const branchMetadataAtSource = repo
      .find<Branchable>(doc.branchMetadata.source.url)
      .docSync() // this may fail if we haven't loaded the main doc yet...
      ?.branchMetadata?.branches.find((b) => b.url === handle.url);
    if (branchMetadataAtSource && doc.branchMetadata.source.branchHeads) {
      markers.push({
        id: `origin-of-this-branch`,
        heads: doc.branchMetadata.source.branchHeads,
        users: branchMetadataAtSource.createdBy
          ? [branchMetadataAtSource.createdBy]
          : [],
        type: "originOfThisBranch",
        source: doc.branchMetadata.source,
        branch: branchMetadataAtSource,
        hideHistoryBeforeThis: true,
      });
    }
  }

  /** Mark new branches off this one */
  markers = markers.concat(
    doc.branchMetadata.branches
      .filter(
        (branch) =>
          branch.branchHeads !== undefined &&
          !isEqual(branch.branchHeads, doc.branchMetadata.source?.branchHeads)
      )
      .map((branch) => ({
        id: `branch-created-${branch.branchHeads[0]}`,
        users: branch.createdBy ? [branch.createdBy] : [],
        heads: branch.branchHeads,
        type: "branchCreatedFromThisDoc",
        branch,
      }))
  );

  /** Mark tags aka milestones */
  markers = markers.concat(
    (doc.tags ?? []).map((tag: Tag) => ({
      id: `tag-${tag.heads[0]}-${tag.name}`,
      heads: tag.heads,
      type: "tag" as const,
      tag,
      users: tag.createdBy ? [tag.createdBy] : [],
    }))
  );

  return markers;
};

// NOTE: this should be pushed down the stack as we formalize
// support for structured metadata on changes.
const getAllChangesWithMetadata = (doc: Doc<unknown>) => {
  return getAllChanges(doc).map((change) => {
    let decodedChange = decodeChange(change) as DecodedChangeWithMetadata;
    decodedChange.metadata = {};
    try {
      const metadata = JSON.parse(decodedChange.message);
      decodedChange = { ...decodedChange, metadata };
    } catch (e) {
      // do nothing for now...
    }
    return decodedChange;
  });
};

export type ChangeGroupingOptions<DocType, Stats> = {
  /** The algorithm used to group changes (picking from presets defined in GROUPINGS) */
  grouping: GroupingAlgorithm<DocType, Stats>;

  /** A numeric parameter used by some grouping algorithms for things like batch size.
   *  TODO: this should probably be more specifically named per grouping algo?
   */
  numericParameter: number;

  /** Markers to display at certain heads in the history */
  markers: HeadsMarker<DocType, Stats>[];

  /** Conditon to keep only certain changes */
  changeFilter?: ({
    doc,
    decodedChange,
  }: {
    doc: DocType;
    decodedChange: DecodedChange;
  }) => boolean;

  changeGroupStats?: (changeGroup: ChangeGroup<DocType, Stats>) => Stats;

  changeGroupFilter?: (changeGroup: ChangeGroup<DocType, Stats>) => boolean;
};

/** Returns a flat list of changelog items for display in the UI,
 *  based on a list of change groups.
 */
export const getChangelogItems = <DocType extends Branchable, Stats>(
  doc: Doc<DocType>,
  {
    grouping,
    numericParameter,
    markers,
    changeFilter,
    changeGroupStats,
    changeGroupFilter,
  }: ChangeGroupingOptions<DocType, Stats> = {
    grouping: GROUPINGS.ByActorAndNumChanges,
    numericParameter: 100,
    markers: [],
  }
) => {
  const { changeGroups } = getGroupedChanges(doc, {
    grouping,
    numericParameter,
    markers,
    changeFilter,
    changeGroupStats,
    changeGroupFilter,
  });

  const changelogItems: ChangelogItem<DocType, Stats>[] = [];
  for (const changeGroup of changeGroups) {
    // If this is a branch merge, we treat it in a special way --
    // we don't directly put the change group in as an item;
    // we nest it inside the merge marker.
    const mergeMarker = changeGroup.markers.find(
      (m) => m.type === "otherBranchMergedIntoThisDoc"
    );
    if (mergeMarker) {
      const otherMarkersForThisGroup = changeGroup.markers.filter(
        (m) => m !== mergeMarker
      );
      changelogItems.push({ ...mergeMarker, time: changeGroup.time });
      for (const marker of otherMarkersForThisGroup) {
        changelogItems.push({ ...marker, time: changeGroup.time });
      }
    } else {
      // for normal change groups, push the group and then any markers
      changelogItems.push({
        id: `changeGroup-${changeGroup.from}-${changeGroup.to}`,
        type: "changeGroup",
        changeGroup,
        users: changeGroup.authorUrls,
        heads: [changeGroup.to],
        time: changeGroup.time,
      });
      for (const marker of changeGroup.markers) {
        changelogItems.push({ ...marker, time: changeGroup.time });
      }
    }
  }
  return changelogItems;
};

/** Returns a list of change groups using the specified algorithm.
 *  Markers for specific moments in the history can be passed in;
 *  these automatically split the groups at the marker.
 *  The structure returned by this function is a list of change groups
 *  with markers attached; if you want a flat list of changelog items
 *  for display, use getChangelogItems.
 */
export const getGroupedChanges = <DocType extends Branchable, Stats>(
  doc: Doc<DocType>,
  {
    grouping,
    numericParameter,
    markers,
    changeFilter,
    changeGroupFilter,
    changeGroupStats,
  }: ChangeGroupingOptions<DocType, Stats> = {
    grouping: GROUPINGS.ByActorAndNumChanges,
    /** Some algorithms have a numeric parameter like batch size that the user can control */
    numericParameter: 100,
    markers: [],
  }
) => {
  // TODO: we should sort this list in a stable way across devices.
  const changes = getAllChangesWithMetadata(doc);
  const changeGroups: ChangeGroup<DocType, Stats>[] = [];

  let currentGroup: ChangeGroup<DocType, Stats> | null = null;

  // define a helper for pushing a new group onto the list
  const pushGroup = (group: ChangeGroup<DocType, Stats>) => {
    group.id = `${group.from}-${group.to}`;

    const diffHeads =
      changeGroups.length > 0 ? [changeGroups[changeGroups.length - 1].to] : [];
    group.diff = diffWithProvenance(doc, diffHeads, [group.to]);
    group.docAtEndOfChangeGroup = view(doc, [group.to]);

    if (changeGroupStats) {
      group.stats = changeGroupStats(group);
    }

    if (changeGroupFilter && !changeGroupFilter(group)) {
      return;
    }
    changeGroups.push(group);
  };

  // for each merged branch in the doc, we need to start a change group for that branch.
  // anytime we hit a change claimed by a merged branch, it's not considered in the regular
  // grouping logic, it's instead added to the single group for that branch.
  // then we add the branch's change group to the list once we hit its merge point.

  const branchChangeGroups: {
    [key: string]: {
      changeGroup: ChangeGroup<DocType, Stats>;
      changeHashes: Set<Hash>;
      mergeMetadata: Branch["mergeMetadata"];
    };
  } = {};
  for (const branch of doc.branchMetadata.branches) {
    if (branch.mergeMetadata && branch.branchHeads) {
      branchChangeGroups[branch.url] = {
        changeGroup: {
          id: `${branch.branchHeads[0]}-${branch.mergeMetadata.mergeHeads[0]}`,
          from: branch.branchHeads[0],
          to: branch.mergeMetadata.mergeHeads[0],
          changes: [],
          actorIds: [],
          authorUrls: [],
          docAtEndOfChangeGroup: undefined,
          diff: { patches: [], fromHeads: [], toHeads: [] },
          markers: [],
          time: undefined,
        },
        changeHashes: getChangesFromMergedBranch({
          decodedChangesForDoc: changes,
          branchHeads: branch.mergeMetadata.mergeHeads,
          mainHeads: getHeads(doc),
          baseHeads: branch.branchHeads ?? [],
        }),
        mergeMetadata: branch.mergeMetadata,
      };
    }
  }

  // Now we loop over the changes and make our groups.

  for (let i = 0; i < changes.length; i++) {
    const decodedChange = changes[i];

    const skipChange =
      // See if the datatype wants this change to appear in the log
      changeFilter &&
      !changeFilter({ doc, decodedChange }) &&
      // If a marker is present for this change, we have to include it so that the marker works.
      !markers.find((marker) => marker.heads.includes(decodedChange.hash));

    if (skipChange) {
      continue;
    }

    // If the change came from a merged branch, add it to the group for that branch,
    // don't include it in our raw grouping.
    let changeCameFromMergedBranch = false;
    for (const branchChangeGroup of Object.values(branchChangeGroups)) {
      if (branchChangeGroup.changeHashes.has(decodedChange.hash)) {
        // Now that we've hit changes from a branch, cut off the current group that was formed on main.
        // (TODO: maybe we should be looking out for "branch started" markers on the primary loop instead?)
        if (currentGroup) {
          pushGroup(currentGroup);
          currentGroup = null;
        }

        // we'll use this to break out of the main loop
        changeCameFromMergedBranch = true;
        branchChangeGroup.changeGroup.changes.push(decodedChange);

        // TODO: DRY the logic for updating these fields
        if (decodedChange.time && decodedChange.time > 0) {
          branchChangeGroup.changeGroup.time = decodedChange.time;
        }
        if (
          !branchChangeGroup.changeGroup.actorIds.includes(decodedChange.actor)
        ) {
          branchChangeGroup.changeGroup.actorIds.push(decodedChange.actor);
        }
        if (
          decodedChange.metadata?.author &&
          !branchChangeGroup.changeGroup.authorUrls.includes(
            decodedChange.metadata.author as AutomergeUrl
          )
        ) {
          branchChangeGroup.changeGroup.authorUrls.push(
            decodedChange.metadata.author as AutomergeUrl
          );
        }

        // If this is the change that was the last one for the branch
        // pre-merged, then it's time to add the change group for this branch
        // to our list of groups
        if (
          branchChangeGroup.mergeMetadata.mergeHeads.includes(
            decodedChange.hash
          )
        ) {
          const markersForGroup = markers.filter((marker) =>
            isEqual(marker.heads, branchChangeGroup.mergeMetadata.mergeHeads)
          );
          const mergeMarker = markersForGroup.find(
            (m) => m.type === "otherBranchMergedIntoThisDoc"
          );
          if (mergeMarker) {
            branchChangeGroup.changeGroup.markers.push({
              ...mergeMarker,
              // @ts-expect-error this is fine; we know we're adding to a merge marker
              changeGroups: [branchChangeGroup.changeGroup],
            });
            const otherMarkersForThisGroup = markersForGroup.filter(
              (m) => m !== mergeMarker
            );
            for (const marker of otherMarkersForThisGroup) {
              branchChangeGroup.changeGroup.markers.push(marker);
            }
          }

          // todo: what other finalizing do we need to do here..? any?
          pushGroup(branchChangeGroup.changeGroup);
        }

        continue;
      }
    }

    if (changeCameFromMergedBranch) {
      continue;
    }

    // Choose whether to add this change to the existing group or start a new group depending on the algorithm.
    if (
      currentGroup &&
      grouping(currentGroup, decodedChange, numericParameter)
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.to = decodedChange.hash;
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
      const matchingMarkers = markers.filter((marker) => {
        return marker.heads[0] === decodedChange.hash;
      });
      if (matchingMarkers.length > 0) {
        currentGroup.markers = matchingMarkers;
        pushGroup(currentGroup);
        currentGroup = null;
      }
    } else {
      if (currentGroup) {
        pushGroup(currentGroup);
      }
      currentGroup = {
        // the "ID" is the hash of the latest change in the group.
        // TODO: revisit whether this makes sense as an identifier for the group?
        // It's a bit dangerous to store this separately from the changes since they
        // might get out of sync, but it's super convenient in the view...
        id: `${decodedChange.hash}-${decodedChange.hash}`,
        from: decodedChange.hash,
        to: decodedChange.hash,
        changes: [decodedChange],
        actorIds: [decodedChange.actor],
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
      };
    }
  }

  if (currentGroup) {
    pushGroup(currentGroup);
  }

  return { changeGroups, changeCount: changes.length };
};
