import { Button } from "@/components/ui/button";
import {
  Comment,
  CommentThread,
  CommentThreadWithPosition,
  MarkdownDoc,
} from "../schema";

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
import { useEffect, useState } from "react";
import { getRelativeTimeString, cmRangeToAMRange } from "../utils";
import { useCurrentAccount } from "@/DocExplorer/account";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  threadsWithPositions,
  activeThreadId,
  setActiveThreadId,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  threadsWithPositions: CommentThreadWithPosition[];
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
}) => {
  const account = useCurrentAccount();
  const [pendingCommentText, setPendingCommentText] = useState("");
  const [commentBoxOpen, setCommentBoxOpen] = useState(false);
  const [activeReplyThreadId, setActiveReplyThreadId] = useState<
    string | null
  >();

  // suppress showing the button immediately after adding a thread
  const [suppressButton, setSuppressButton] = useState(false);
  const showCommentButton =
    selection && selection.from !== selection.to && !suppressButton;

  // un-suppress the button once the selection changes
  useEffect(() => {
    setSuppressButton(false);
  }, [selection?.from, selection?.to]);

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const amRange = cmRangeToAMRange(selection);

    const fromCursor = A.getCursor(doc, ["content"], amRange.from);
    const toCursor = A.getCursor(doc, ["content"], amRange.to);

    const comment: Comment = {
      id: uuid(),
      content: commentText,
      userId: null,
      contactUrl: account?.contactHandle.url,
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
      contactUrl: account?.contactHandle.url,
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
          className={`bg-white hover:border-gray-400 hover:bg-gray-50 p-4 mr-2 absolute border border-gray-300 rounded-sm max-w-lg transition-all duration-100 ease-in-out ${
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
            {thread.comments.map((comment) => {
              const legacyUserName =
                doc.users?.find((user) => user.id === comment.userId)?.name ??
                "Anonymous";

              return (
                <div
                  key={comment.id}
                  className="mb-3 pb-3  rounded-md border-b border-b-gray-200 last:border-b-0"
                >
                  <div className="text-xs text-gray-600 mb-1 cursor-default flex items-center">
                    {comment.contactUrl ? (
                      <ContactAvatar
                        url={comment.contactUrl}
                        showName={true}
                        size="sm"
                      />
                    ) : (
                      legacyUserName
                    )}
                    <span className="ml-2 text-gray-400">
                      {getRelativeTimeString(comment.timestamp)}
                    </span>
                  </div>
                  <div className="cursor-default text-sm whitespace-pre-wrap mt-2">
                    {comment.content}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <Popover
              open={activeReplyThreadId === thread.id}
              onOpenChange={(open) =>
                open
                  ? setActiveReplyThreadId(thread.id)
                  : setActiveReplyThreadId(null)
              }
            >
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.metaKey) {
                      addReplyToThread(thread.id);
                      setActiveReplyThreadId(null);
                      event.preventDefault();
                    }
                  }}
                />

                <PopoverClose>
                  <Button
                    variant="outline"
                    onClick={() => addReplyToThread(thread.id)}
                  >
                    Comment
                    <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
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
      <Popover
        open={commentBoxOpen}
        onOpenChange={() => setCommentBoxOpen((prev) => !prev)}
      >
        <PopoverTrigger asChild>
          {showCommentButton && (
            <Button
              className="relative shadow-md w-44"
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) + 23,
                left: -50,
              }}
            >
              <MessageSquarePlus size={24} className="mr-2" />
              Add comment
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent>
          <Textarea
            className="mb-4"
            value={pendingCommentText}
            onChange={(event) => setPendingCommentText(event.target.value)}
            // GL Nov: figure out how to close the popover upon cmd-enter submit
            // GL 12/14: the answer here is going to be to control Popover open
            // state ourselves as we now do elsewhere in the codebase
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.metaKey) {
                startCommentThreadAtSelection(pendingCommentText);
                setSuppressButton(true);
                setCommentBoxOpen(false);
                event.preventDefault();
              }
            }}
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
              <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
};
