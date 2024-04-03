import { next as A } from "@automerge/automerge";
import { HasDocMetadata } from "@/DocExplorer/doctypes";
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

export type MarkdownDoc = HasDocMetadata<MarkdownDocAnchor> & {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];
};

export type MarkdownDocAnchor = {
  fromCursor: A.Cursor;
  toCursor: A.Cursor;
};

export type ResolvedMarkdownDocAnchor = MarkdownDocAnchor & {
  fromPos: number;
  toPos: number;
};
