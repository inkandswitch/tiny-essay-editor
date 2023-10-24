import { Button } from "@/components/ui/button";
import { Comment, CommentThread, LocalSession, MarkdownDoc } from "../schema";

import { Check, MessageSquarePlus, Reply } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, uuid } from "@automerge/automerge";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import {
  useScrollPosition,
  getVisibleTheadsWithPos,
  getRelativeTimeString,
  cmRangeToAMRange,
} from "../utils";

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  view,
  session,
  activeThreadId,
  setActiveThreadId,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  view: EditorView | undefined;
  session: LocalSession;
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
}) => {
  console.log("rerender comments sidebar");
  const [pendingCommentText, setPendingCommentText] = useState("");

  // suppress showing the button immediately after adding a thread
  const [suppressButton, setSuppressButton] = useState(false);
  const showCommentButton =
    selection && selection.from !== selection.to && !suppressButton;

  // un-suppress the button once the selection changes
  useEffect(() => {
    setSuppressButton(false);
  }, [selection?.from, selection?.to]);

  // It may be inefficient to rerender comments sidebar on each scroll but
  // it's fine for now and it lets us reposition comments as the user scrolls.
  // (Notably we're not literally repositioning comments in JS;
  // we just use CodeMirror to compute position, and it doesn't tell us position
  // of comments that are way off-screen. That's why we need this scroll handler
  // to catch when things come near the screen)
  useScrollPosition();

  const threadsWithPositions = view
    ? getVisibleTheadsWithPos(doc, view, activeThreadId)
    : [];

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const amRange = cmRangeToAMRange(selection);

    const fromCursor = A.getCursor(doc, ["content"], amRange.from);
    const toCursor = A.getCursor(doc, ["content"], amRange.to);

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
      {threadsWithPositions.map((thread) => (
        <div
          key={thread.id}
          className={`bg-white hover:border-gray-400 hover:bg-gray-50 p-4 absolute border border-gray-300 rounded-sm max-w-lg transition-all duration-100 ease-in-out ${
            thread.id === activeThreadId
              ? "z-50 shadow-sm border-gray-500"
              : "z-0"
          }`}
          style={{
            top: thread.yCoord,
          }}
          onClick={(e) => {
            setActiveThreadId(thread.id);
            e.stopPropagation();
          }}
        >
          <div>
            {thread.comments.map((comment) => (
              <div
                key={comment.id}
                className="mb-3 pb-3  rounded-md border-b border-b-gray-200 last:border-b-0"
              >
                <div className="text-xs text-gray-600 mb-1 cursor-default">
                  {doc.users.find((user) => user.id === comment.userId)?.name ??
                    "Anonymous"}

                  <span className="ml-2 text-gray-400">
                    {getRelativeTimeString(comment.timestamp)}
                  </span>
                </div>
                <div className="cursor-default text-sm whitespace-pre-wrap">
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button className="mr-2" variant="outline">
                  <Reply className="mr-2 " /> Reply
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
                changeDoc((d) => (d.commentThreads[thread.id].resolved = true))
              }
            >
              <Check className="mr-2" /> Resolve
            </Button>
          </div>
        </div>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          {showCommentButton && (
            <Button
              className="relative shadow-md"
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) + 23,
                left: -50,
              }}
            >
              <MessageSquarePlus size={24} className="mr-2" />
              Add a comment
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent>
          <Textarea
            className="mb-4"
            value={pendingCommentText}
            onChange={(event) => setPendingCommentText(event.target.value)}
            // todo: figure out how to close the popover upon cmd-enter submit
            // onKeyDown={(event) => {
            //   if (event.key === "Enter" && event.metaKey) {
            //     startCommentThreadAtSelection(pendingCommentText);
            //     setSuppressButton(true);
            //     event.preventDefault();
            //   }
            // }}
          />

          <PopoverClose>
            <Button
              variant="outline"
              onClick={() => {
                startCommentThreadAtSelection(pendingCommentText);
                setSuppressButton(true);
              }}
            >
              Comment
              {/* <span className="text-gray-400 ml-2 text-xs">(⌘-⏎)</span> */}
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
};
