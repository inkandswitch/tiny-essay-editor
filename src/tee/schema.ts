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
type PatchWithStableID = A.Patch & { id: string }; // patch id = fromCursor + action
// two heads + a numeric extent?
// just a mark?
// "diff from heads" + spatial range (as cursor) + (optional to heads)
// groupings as an input to the diff algorithm?

export type CommentThread = {
  id: string;
  comments: Comment[];
  resolved: boolean;
  fromCursor: string; // Automerge cursor
  toCursor: string; // Automerge cursor

  /** Diff patches associated with this thread */
  patches?: PatchWithStableID[];

  /**  THIS IS A BAD TEMPORARY DESIGN, TO BE REFACTORED...
   * There are 3 types of comment threads:
   * - a regular comment thread
   * - an ephemeral patch produced by a diff
   * - a "draft": some edits which have been explicitly grouped.
   */
  type?: "comment" | "ephemeralPatch" | "draft";

  /** This is sketchy type design; really a title always exists for draft type comments;
   *  we'll clean this up later with better types.
   */
  draftTitle?: string;
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
