export type Comment = {
  id: string;
  content: string;
  userId: string | null;
  timestamp: number;
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

export type User = {
  id: string;
  name: string;
};

export type LLMTool = { name: string; prompt: string };

export type MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];
  llmTools?: LLMTool[];
};

export type LocalSession = {
  userId: string | null;
};
