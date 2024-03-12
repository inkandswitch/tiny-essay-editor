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

export type Discussion = {
  id: string;
  heads: A.Heads;
  resolved: boolean;
  comments: DiscussionComment[];

  /** An optional specific object being commented on --
   *  could be an object in the document (eg in a text doc, a range of chars)
   *  or possibly (not sure yet) an object in the meta discussion like a change group
   */
  target?: DiscussionTarget;
};

export type Discussable = {
  discussions: { [key: string]: Discussion };
};

export type HasChangeGroupSummaries = {
  changeGroupSummaries: {
    [key: string]: {
      title: string;
    };
  };
};

export type HighlightId = string & { __highlightId: true };

export type Highlight<T> = {
  id: HighlightId;
};

export type Highlightable<T> = {
  highlights: Highlight<T>;
};

export type HasPatchworkMetadata = HasChangeGroupSummaries &
  Branchable &
  Taggable &
  Diffable &
  Discussable;

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

interface HighlightAnnotation<T> {
  type: "highlighted";
  target: T;
}

export type Annotation<T, V> =
  | AddAnnotation<T, V>
  | DeleteAnnotation<T, V>
  | ChangeAnnotation<T, V>;

export interface AnnotationPosition<T, V> {
  x: number;
  y: number;
  annotation: Annotation<T, V>;
}
