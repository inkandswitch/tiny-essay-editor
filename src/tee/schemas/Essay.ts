import { AutomergeClass } from "@/automerge-repo-schema-utils/utils";
import { SchemaToType } from "@/automerge-repo-schema-utils/utils";
import { uuid } from "@automerge/automerge";
import { getCursor, splice } from "@automerge/automerge/next";
import { Schema as S } from "@effect/schema";

const CommentV1 = S.struct({
  id: S.string,
  content: S.string,
  contactUrl: S.optional(S.string),
  timestamp: S.number,
  userId: S.optional(S.string),
});

type CommentV1 = SchemaToType<typeof CommentV1>;
export type Comment = CommentV1;

const CommentThreadV1 = S.struct({
  id: S.string,
  comments: S.array(CommentV1),
  resolved: S.boolean,
  fromCursor: S.string,
  toCursor: S.string,
});

type CommentThreadV1 = SchemaToType<typeof CommentThreadV1>;
export type CommentThread = CommentThreadV1;

const UserV1 = S.struct({
  id: S.string,
  name: S.string,
});

type UserV1 = SchemaToType<typeof UserV1>;
export type User = UserV1;

export const EssayV1 = S.struct({
  content: S.string,
  commentThreads: S.record(S.string, CommentThreadV1),
  users: S.array(UserV1),
});

export type EssayV1 = SchemaToType<typeof EssayV1>;
export type Essay = EssayV1;

export const Essay: AutomergeClass<typeof EssayV1> = {
  schema: EssayV1,

  /* Populate the document with default values */

  // TODO: what should we set as the input type here?
  // It's an empty object that we're initializing;
  // it's not really accurate to say the input type is EssayV1
  // but that also helps with autocomplete...
  init: (doc: EssayV1) => {
    doc.content = "# Untitled\n\n";
    doc.commentThreads = {};
    doc.users = [];
  },

  actions: {
    resolveAllComments: {
      name: "resolve all comments",
      description: "resolve all comments on the doc",
      parameters: {
        type: "object",
        properties: {},
      },
      run: (doc) => {
        for (const threadId in doc.commentThreads) {
          const thread = doc.commentThreads[threadId];
          thread.resolved = true;
        }
      },
    },
    startThread: {
      name: "start thread",
      description: "Start a new comment thread",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Quoted text which is the target of the comment",
          },
          comment: {
            type: "string",
            description: "The content of the comment",
          },
        },
      },
      run: (doc, params) => {
        const textStartIndex = doc.content.indexOf(params.text);
        if (textStartIndex < 0) {
          throw new Error(`text not found: ${params.text}`);
        }
        const textEndIndex = textStartIndex + params.text.length - 1;

        const fromCursor = getCursor(doc, ["content"], textStartIndex);
        const toCursor = getCursor(doc, ["content"], textEndIndex);

        const comment: Comment = {
          id: uuid(),
          content: params.comment,
          userId: null,
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
  },

  fileExports: {
    Markdown: (doc: EssayV1): Blob => {
      return new Blob([doc.content], { type: "text/markdown" });
    },
  },

  // Dubious whether this deserves its own API..?
  /* Mark a document as a copy of another document */
  markAsCopy: (doc: EssayV1) => {
    const firstHeadingIndex = doc.content.search(/^#\s.*$/m);
    if (firstHeadingIndex !== -1) {
      splice(doc, ["content"], firstHeadingIndex + 2, 0, "Copy of ");
    }
  },
};
