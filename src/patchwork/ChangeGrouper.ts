import { DocHandle, Repo } from "@automerge/automerge-repo";
import { EventEmitter } from "eventemitter3";
import {
  ChangeGroup,
  ChangeGroupingOptions,
  ChangelogItem,
  DecodedChangeWithMetadata,
  getChangelogItems,
  getMarkersForDoc,
} from "./groupChanges";
import { HasPatchworkMetadata, UnknownPatchworkDoc } from "./schema";
import { next as A } from "@automerge/automerge";
import { debounce, isEqual } from "lodash";

const GROUPER_DEBOUNCE_MS = 1000;

/**This is a class that wraps a doc handle and emits events
 * when the changelog items change.
 * Most of the actual work gets delegated to getChangelogItems;
 * the main purpose of this stateful class is to improve performance
 * by maintaining a cache of decoded changes and by debouncing updates.
 */
export class ChangeGrouper<D extends UnknownPatchworkDoc> extends EventEmitter {
  private handle: DocHandle<D>;
  private repo: Repo;
  private groupingOptions: Omit<ChangeGroupingOptions<D>, "markers">;
  // An array of decoded changes on the doc.
  private decodedChanges: DecodedChangeWithMetadata[];
  private debouncedListener;
  items: ChangelogItem<D>[];

  private memoizedGroups: {
    changeGroups: ChangeGroup<D>[];
    changeCount: number;
    options: ChangeGroupingOptions<D>;
  };

  constructor(
    handle: DocHandle<D>,
    repo: Repo,
    groupingOptions: Omit<ChangeGroupingOptions<D>, "markers">
  ) {
    super();
    this.handle = handle;
    this.repo = repo;
    this.groupingOptions = groupingOptions;
    this.debouncedListener = debounce(
      () => this.populateItems(),
      GROUPER_DEBOUNCE_MS
    );
    this.decodedChanges = [];

    // Get change groups using initial state of the doc.
    if (handle.docSync()) {
      this.populateItems();
    }

    // Listen for changes to the doc and update the items array as needed.
    let cachedMarkers;
    handle.on("change", () => {
      const markers = getMarkersForDoc(this.handle, this.repo);
      if (!isEqual(markers, cachedMarkers)) {
        // If the markers on the doc have changed, then we immediately recompute change groups
        cachedMarkers = markers;
        this.populateItems();
      } else {
        // If the markers haven't changed, then do a debounced recompute.
        this.debouncedListener();
      }
    });
  }

  // Recompute changelog items for the current state of the doc
  private populateItems() {
    // This call to getAllChanges is still quite slow; it'd be a lot faster
    // if Automerge simply had an API to get a subset of changes.
    const rawChanges = A.getAllChanges(this.handle.docSync());

    // Only decode new changes.
    // Note, this only works because new changes are added to the end of the list;
    // if that invariant changes we'll need a new way to keep track of which
    // changes we've already decoded.

    if (rawChanges.length > this.decodedChanges.length) {
      const newDecodedChanges = rawChanges
        .slice(this.decodedChanges.length)
        .map(decodeChangeAndParseMetadata);
      this.decodedChanges = this.decodedChanges.concat(newDecodedChanges);
      const markers = getMarkersForDoc(this.handle, this.repo);

      const { items, memoizedGroups } = getChangelogItems({
        doc: this.handle.docSync(),
        changes: this.decodedChanges,
        options: { ...this.groupingOptions, markers },
        memoizedGroups: this.memoizedGroups,
      });
      this.items = items;
      this.memoizedGroups = memoizedGroups;
      this.emit("change", this.items);
    }
  }

  public teardown() {
    this.handle.off("change", this.debouncedListener);
    this.items = [];
  }
}

// NOTE: this should be pushed down the stack as we formalize
// support for structured metadata on changes.
const decodeChangeAndParseMetadata = (change: A.Change) => {
  let decodedChange = A.decodeChange(change) as DecodedChangeWithMetadata;
  decodedChange.metadata = {};
  try {
    const metadata = JSON.parse(decodedChange.message);
    decodedChange = { ...decodedChange, metadata };
  } catch (e) {
    // do nothing for now...
  }
  return decodedChange;
};
