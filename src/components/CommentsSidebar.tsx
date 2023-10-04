import { Button } from "@/components/ui/button";
import {
  Comment,
  CommentThread,
  CommentThreadWithResolvedPositions,
  LocalSession,
  MarkdownDoc,
} from "../schema";

import { Check, MessageSquarePlus, Reply } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, uuid } from "@automerge/automerge";
import { mapValues } from "lodash";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { EditorView } from "codemirror";
import { useState } from "react";
import useScrollPosition, { commentThreadsWithPositions } from "@/utils";

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  view,
  session,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  view: EditorView | undefined;
  session: LocalSession;
}) => {
  const [pendingCommentText, setPendingCommentText] = useState("");
  const showCommentButton = selection && selection.from !== selection.to;

  // It may be inefficient to rerender comments sidebar on each scroll but
  // it's fine for now and it lets us reposition comments as the user scrolls.
  // (Notably we're not literally repositioning comments in JS;
  // we just use CodeMirror to compute position, and it doesn't tell us position
  // of comments that are way off-screen. That's why we need this scroll handler
  // to catch when things come near the screen)
  useScrollPosition();

  const threadsWithPositions = view
    ? commentThreadsWithPositions(doc, view)
    : {};

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const fromCursor = A.getCursor(doc, ["content"], selection.from);
    const toCursor = A.getCursor(doc, ["content"], selection.to);

    const comment: Comment = {
      id: uuid(),
      content: commentText,
      userId: session?.userId ?? null,
      timestamp: Date.now(),
    };

    const thread: CommentThread = {
      id: uuid(),
      comments: [comment],
      resolved: false,
      fromCursor,
      toCursor,
    };

    changeDoc((doc) => {
      doc.commentThreads[thread.id] = thread;
    });

    setPendingCommentText("");
  };

  const addReplyToThread = (threadId: string) => {
    const comment: Comment = {
      id: uuid(),
      content: pendingCommentText,
      userId: session?.userId ?? null,
      timestamp: Date.now(),
    };

    changeDoc((doc) => {
      doc.commentThreads[threadId].comments.push(comment);
    });

    setPendingCommentText("");
  };

  return (
    <div>
      <div className="flex-grow bg-gray-50 p-4">
        {Object.values(threadsWithPositions)
          .filter((thread) => !thread.resolved)
          .map((thread) => (
            <div
              key={thread.id}
              className="bg-white p-4 absolute"
              style={{ top: thread.yCoord }}
            >
              {thread.comments.map((comment) => (
                <div className="mb-4 pb-4 border-b border-gray-300">
                  <div className="text-sm text-gray-600 mb-1">
                    {doc.users.find((user) => user.id === comment.userId)
                      .name ?? "unknown"}
                  </div>
                  <div>{comment.content}</div>
                </div>
              ))}
              <div className="mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button className="mr-2" variant="outline">
                      <Reply className="mr-2" /> Reply
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <Textarea
                      className="mb-4"
                      value={pendingCommentText}
                      onChange={(event) =>
                        setPendingCommentText(event.target.value)
                      }
                    />

                    <PopoverClose>
                      <Button
                        variant="outline"
                        onClick={() => addReplyToThread(thread.id)}
                      >
                        Comment
                      </Button>
                    </PopoverClose>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  onClick={() =>
                    changeDoc(
                      (d) => (d.commentThreads[thread.id].resolved = true)
                    )
                  }
                >
                  <Check className="mr-2" /> Resolve thread
                </Button>
              </div>
            </div>
          ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className={`z-100 transition fixed duration-200 ease-in-out ${
                showCommentButton ? "opacity-100" : "opacity-0"
              }`}
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) - 11,
              }}
            >
              <MessageSquarePlus size={24} className="mr-2" />
              Add a comment
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Textarea
              className="mb-4"
              value={pendingCommentText}
              onChange={(event) => setPendingCommentText(event.target.value)}
            />

            <PopoverClose>
              <Button
                variant="outline"
                onClick={() =>
                  startCommentThreadAtSelection(pendingCommentText)
                }
              >
                Comment
              </Button>
            </PopoverClose>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
