import { uuid } from "@automerge/automerge";
import { ActionSpec } from "./types";
import { CommentThread, Comment } from "./schema";
import { next as A } from "@automerge/automerge";

export const MarkdownDocActions: ActionSpec = {
  "resolve all comments": {
    params: {},
    action: (doc) => {
      console.log("resolve");
      for (const threadId in doc.commentThreads) {
        const thread = doc.commentThreads[threadId];
        thread.resolved = true;
      }
    },
  },
  "start new thread": {
    params: {
      "comment text": "string",
      "user id": "string",
      "text start index": "number",
      "text end index": "number",
    },
    action: (doc, params) => {
      const fromCursor = A.getCursor(
        doc,
        ["content"],
        params["text start index"]
      );
      const toCursor = A.getCursor(doc, ["content"], params["text end index"]);

      const comment: Comment = {
        id: uuid(),
        content: params["comment text"],
        userId: params["user id"],
        timestamp: Date.now(),
      };

      const thread: CommentThread = {
        id: uuid(),
        comments: [comment],
        resolved: false,
        fromCursor,
        toCursor,
      };

      doc.commentThreads[thread.id] = thread;
    },
  },
};
