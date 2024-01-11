import { Heads } from "@automerge/automerge";
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

export type CommentThread = {
  id: string;
  comments: Comment[];
  resolved: boolean;
  fromCursor: string; // Automerge cursor
  toCursor: string; // Automerge cursor
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
      copyHeads: Heads;
    } | null;

    /* A pointer to copies of this doc */
    copies: Array<{
      url: AutomergeUrl;
      copyTimestamp: number;
      name: string;
    }>;
  };
};

export type MarkdownDoc = _MarkdownDoc & Copyable;
