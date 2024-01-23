import * as A from "@automerge/automerge/next";
import { AutomergeUrl } from "@automerge/automerge-repo";

export type Comment = {
  id: string;
  content: string;
  contactUrl?: AutomergeUrl;
  timestamp: number;

  // A legacy field for backwards compatibility.
  // Was used to point to user objects in the doc itself.
  // Now superceded by contactUrl.
  userId?: string | null;
};

/** Attempting to give diff patches stable identity across doc versions,
 * for the purposes of equivalence checks... TBD how this turns out.
 **/
type PatchWithStableID = A.Patch & { id: string };

export type CommentThread = {
  id: string;
  comments: Comment[];
  resolved: boolean;
  fromCursor: string; // Automerge cursor
  toCursor: string; // Automerge cursor

  /** Diff patches associated with this thread */
  patches?: PatchWithStableID[];

  /** Sometimes threads aren't really stored in the doc, they're
   * just inferred from a diff. This flag marks those threads.
   * (Once we have some manual metadata like a grouping or a note
   * on a diff, then we actually store it in the doc.)
   */
  inferredFromDiff?: boolean;
};

export type CommentThreadForUI = CommentThread & {
  from: number;
  to: number;
  active: boolean;
};

export type CommentThreadWithPosition = CommentThreadForUI & { yCoord: number };

export type User = {
  id: string;
  name: string;
};

type _MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];
};

export type Copyable = {
  copyMetadata: {
    /* A pointer to the source where this was copied from */
    source: {
      url: AutomergeUrl;
      copyHeads: A.Heads;
    } | null;

    /* A pointer to copies of this doc */
    copies: Array<{
      url: AutomergeUrl;
      copyTimestamp: number;
      name: string;
    }>;
  };
};

export type Tag = { name: string; heads: A.Heads };
export type Taggable = {
  // TODO: should we model this as a map instead?
  tags: Tag[];
};

export type MarkdownDoc = _MarkdownDoc & Copyable & Taggable;
