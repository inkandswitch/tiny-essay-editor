import { CommentThread } from "./schemas/Essay";

export type CommentThreadForUI = CommentThread & {
  from: number;
  to: number;
  active: boolean;
};
export type CommentThreadWithPosition = CommentThreadForUI & { yCoord: number };
