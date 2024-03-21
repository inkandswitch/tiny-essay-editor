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
import { HasPatchworkMetadata } from "./schema";
import { next as A } from "@automerge/automerge";

// This is a class that wraps a doc handle and emits a change event
// whenever the changelog items for the doc change.
// Its main purpose is to maintain a cache of decoded changes for perf, so that
// callers can avoid decoding all the changes every time anything changes.
export class ChangeGrouper<
  D extends HasPatchworkMetadata<unknown, unknown>
> extends EventEmitter {
  private handle: DocHandle<D>;
  private repo: Repo;
  private groupingOptions: Omit<ChangeGroupingOptions<D>, "markers">;
  // An array of decoded changes on the doc.
  private decodedChanges: DecodedChangeWithMetadata[];
  private listener = () => this.populateItems();
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
    this.decodedChanges = [];

    // Populate the items array with the initial state of the doc.
    if (handle.docSync()) {
      this.populateItems();
    }

    // Listen for changes to the doc and update the items array.
    handle.on("change", this.listener);
  }

  // Recompute changelog items for the current state of the doc
  private populateItems() {
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
    this.handle.off("change", this.listener);
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
