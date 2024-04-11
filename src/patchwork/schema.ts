import { AutomergeUrl } from "@automerge/automerge-repo";
import { PatchWithAttr } from "@automerge/automerge-wasm";
import { TextPatch } from "./utils";
import * as A from "@automerge/automerge/next";
import { EditRange } from "@/tee/schema";

export type Branch = {
  name: string;
  /** URL pointing to the clone doc */
  url: AutomergeUrl;
  /** timestamp when the branch was created */
  createdAt: number;
  /** Heads when the branch was created */
  branchHeads: A.Heads;
  /** author contact doc URL for branch creator */
  createdBy?: AutomergeUrl;

  mergeMetadata?: {
    /** timestamp when the branch was merged */
    mergedAt: number;
    /** Heads of the branch at the point it was merged */
    mergeHeads: A.Heads;
    /** author contact doc URL for branch merger */
    mergedBy: AutomergeUrl;
  };
};

export type Branchable = {
  branchMetadata: {
    /* A pointer to the source where this was copied from */
    source: {
      url: AutomergeUrl;
      branchHeads: A.Heads; // the heads at which this branch was forked off
    } | null;

    /* A pointer to copies of this doc */
    branches: Array<Branch>;
  };
};

export type Tag = {
  name: string;
  heads: A.Heads;
  createdAt: number;
  createdBy?: AutomergeUrl;
};
export type Taggable = {
  // TODO: should we model this as a map instead?
  tags: Tag[];
};

export type Diffable = {
  diffBase: A.Heads;
};
// A data structure that lets us pass around diffs while remembering
// where they came from

export type DiffWithProvenance = {
  patches: (A.Patch | PatchWithAttr<AutomergeUrl> | TextPatch)[]; // just pile on more things, it could be anyone of these three ...
  fromHeads: A.Heads;
  toHeads: A.Heads;
};
export type SpatialBranch = {
  from: A.Cursor;
  to: A.Cursor;
  docUrl: AutomergeUrl;
};

export interface EditRangeTarget {
  type: "editRange";
  value: EditRange;
}

export type DiscussionTarget = EditRangeTarget; // | ... future other options from other doctypes

export type DiscussionComment = {
  id: string;
  content: string;
  contactUrl?: AutomergeUrl;
  timestamp: number;
};

// Right now discussions are both used in the timeline and for comments on the document
// We should split this up and use separate concepts
export type Discussion<D, A extends Anchor<D, V>, V> = {
  id: string;
  heads: A.Heads;
  resolved: boolean;
  comments: DiscussionComment[];

  // optionally a list of doc anchors that this discussion refers to
  anchors?: A[];
};

export type Discussable<D, A extends Anchor<D, V>, V> = {
  discussions: { [key: string]: Discussion<D, A, V> };
};

export type HasChangeGroupSummaries = {
  changeGroupSummaries: {
    [key: string]: {
      title: string;
    };
  };
};

export type HasPatchworkMetadata<
  D,
  A extends Anchor<D, V>,
  V
> = HasChangeGroupSummaries &
  Branchable &
  Taggable &
  Diffable &
  Discussable<D, A, V>;

export type UnknownPatchworkDoc = A.Doc<
  HasPatchworkMetadata<unknown, Anchor<unknown, unknown>, unknown>
>;

export type AnnotationId = string & { __annotationId: true };

export abstract class Anchor<D, V> {
  abstract resolve(doc: D): V | undefined;

  abstract toJson(): any;

  abstract doesOverlap(anchor: Anchor<D, V>, doc: D): boolean;

  abstract sortValue(): string | number;
}

interface AddAnnotation<D, V> {
  type: "added";
  anchor: Anchor<D, V>;
  added: V;
}

interface DeleteAnnotation<D, V> {
  type: "deleted";
  anchor: Anchor<D, V>;
  deleted: V;
}

interface ChangeAnnotation<D, V> {
  type: "changed";
  anchor: Anchor<D, V>;
  before: V;
  after: V;
}

export interface HighlightAnnotation<D, V> {
  type: "highlighted";
  anchor: Anchor<D, V>;
  value: V;
}

export type Annotation<D, V> =
  | AddAnnotation<D, V>
  | DeleteAnnotation<D, V>
  | ChangeAnnotation<D, V>
  | HighlightAnnotation<D, V>;

export type AnnotationWithState<D, V> = Annotation<D, V> & {
  hasSpotlight: boolean;
};

export type AnnotationGroup<D, A extends Anchor<D, V>, V> = {
  annotations: Annotation<D, V>[];
  discussion?: Discussion<D, A, V>;
};

export type UnknownAnnotationGroup = AnnotationGroup<
  unknown,
  Anchor<unknown, unknown>,
  unknown
>;

export type AnnotationGroupWithState<
  D,
  A extends Anchor<D, V>,
  V
> = AnnotationGroup<D, A, V> & {
  state: "focused" | "expanded" | "neutral";
};

export type UnknownAnnotationGroupWithState = AnnotationGroupWithState<
  unknown,
  Anchor<unknown, unknown>,
  unknown
>;

export const initPatchworkMetadata = (doc: any) => {
  doc.branchMetadata = {
    source: null,
    branches: [],
  };
  doc.discussions = {};
  doc.tags = [];
  doc.changeGroupSummaries = {};
};
