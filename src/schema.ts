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

export type MarkdownDoc = {
  content: string;
  commentThreads: { [key: string]: CommentThread };
};
