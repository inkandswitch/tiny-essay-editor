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

type FileEntry = {
  contentType: string;
  contents: string | Uint8Array;
};

export type MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];

  // todo: generalize for other data types
  assets: { [filename: string]: FileEntry };
};
