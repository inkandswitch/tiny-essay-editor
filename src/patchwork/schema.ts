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
export type Discussion<T> = {
  id: string;
  heads: A.Heads;
  resolved: boolean;
  comments: DiscussionComment[];

  // optionally a list of doc anchors that this discussion refers to
  target?: T[];
};

export type AnnotationGroup<T, V> = {
  annotations: Annotation<T, V>[];
  discussion?: Discussion<T>;
};

export type AnnotationGroupWithState<T, V> = AnnotationGroup<T, V> & {
  state: "focused" | "expanded" | "neutral";
};

export type Discussable<T> = {
  discussions: { [key: string]: Discussion<T> };
};

export type HasChangeGroupSummaries = {
  changeGroupSummaries: {
    [key: string]: {
      title: string;
    };
  };
};

export type HasPatchworkMetadata<T, V> = HasChangeGroupSummaries &
  Branchable &
  Taggable &
  Diffable &
  Discussable<T>;

export type AnnotationId = string & { __annotationId: true };

interface AddAnnotation<T, V> {
  type: "added";
  target: T;
  added: V;
}

interface DeleteAnnotation<T, V> {
  type: "deleted";
  target: T;
  deleted: V;
}

interface ChangeAnnotation<T, V> {
  type: "changed";
  target: T;
  before: V;
  after: V;
}

export interface HighlightAnnotation<T, V> {
  type: "highlighted";
  target: T;
  value: V;
}

export type Annotation<T, V> =
  | AddAnnotation<T, V>
  | DeleteAnnotation<T, V>
  | ChangeAnnotation<T, V>
  | HighlightAnnotation<T, V>;

export type AnnotationWithState<T, V> = Annotation<T, V> & {
  isFocused: boolean;
};

export interface AnnotationPosition<T, V> {
  x: number;
  y: number;
  annotation: Annotation<T, V>;
}

export const initPatchworkMetadata = (doc: any) => {
  doc.branchMetadata = {
    source: null,
    branches: [],
  };
  doc.discussions = {};
  doc.tags = [];
  doc.changeGroupSummaries = {};
};
