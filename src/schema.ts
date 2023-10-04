export type Comment = {
  id: string;
  content: string;
  user: string;
  timestamp: number;
};

export type CommentThread = {
  id: string;
  comments: Comment[];
  resolved: boolean;
};

export type User = {
  id: string;
  name: string;
};

export type MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
  users: User[];
};

export type LocalSession = {
  userId: string | null;
};
