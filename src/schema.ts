export type Comment = {
  id: string;
  content: string;
  user: string;
  timestamp: string;
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
