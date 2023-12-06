import { Doc, Heads, Patch } from "@automerge/automerge";
import { Schema as S } from "@effect/schema";

const Comment = S.struct({
  id: S.string,
  content: S.string,
  userId: S.nullable(S.string),
  timestamp: S.number,
});

export type Comment = S.Schema.To<typeof Comment>;

const CommentThread = S.struct({
  id: S.string,
  comments: S.array(Comment),
  resolved: S.boolean,
  fromCursor: S.string, // Automerge cursor
  toCursor: S.string, // Automerge cursor
});

export type CommentThread = S.Schema.To<typeof CommentThread>;

export type CommentThreadForUI = CommentThread & {
  from: number;
  to: number;
  active: boolean;
};

export type CommentThreadWithPosition = CommentThreadForUI & { yCoord: number };

const User = S.struct({
  id: S.string,
  name: S.DateFromString,
});

export type User = S.Schema.To<typeof User>;

export const parseUser = S.parseSync(User);

export type LocalSession = {
  userId: string | null;
};

export const MarkdownDoc = S.struct({
  content: S.string,
  commentThreads: S.readonlyMap(S.string, CommentThread),
  users: S.array(User),
});

export type MarkdownDoc = S.Schema.To<typeof MarkdownDoc>;

export type Snapshot = {
  heads: Heads;
  doc: Doc<MarkdownDoc>;
  previous: Snapshot | null;
  diffFromPrevious: Patch[];
};
