import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Check, MessageSquarePlus, Reply } from "lucide-react";

import { AnnotationGroupWithPosition } from "../utils";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MarkdownDoc } from "@/datatypes/markdown";
import { useCurrentAccount } from "@/os/explorer/account";
import { getAnnotationGroupId } from "@/os/versionControl/annotations";
import { AnnotationGroupView } from "@/os/versionControl/components/ReviewSidebar";
import { SelectionRange } from "@codemirror/state";
import { useEffect, useState } from "react";

export const CommentsSidebar = ({
  doc,
  handle,
  selection,
  annotationGroupsWithPosition,
  setSelectedAnnotationGroupId,
}: {
  doc: MarkdownDoc;
  handle: DocHandle<MarkdownDoc>;
  selection: SelectionRange;
  annotationGroupsWithPosition: AnnotationGroupWithPosition[];
  setSelectedAnnotationGroupId: (id: string) => void;
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

  /*const startCommentThreadAtSelection = (commentText: string) => {
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
  };*/

  /*const addReplyToThread = (threadId: string) => {
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
  };*/

  return (
    <div>
      {annotationGroupsWithPosition.map((annotationGroup, index) => (
        <div
          key={index}
          className={`absolute transition-all ease-in-out w-[350px] ${
            annotationGroup.state === "expanded"
              ? "z-50 shadow-sm border-gray-500"
              : "z-0"
          }`}
          style={{
            top: annotationGroup.yCoord,
          }}
          onClick={(e) => {
            setSelectedAnnotationGroupId(getAnnotationGroupId(annotationGroup));
            e.stopPropagation();
          }}
        >
          <div>
            <AnnotationGroupView
              doc={doc}
              handle={handle}
              annotationGroup={annotationGroup}
              datatypeId="essay"
            />
          </div>
          {false && (
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
                  changeDoc(
                    (d) => (d.commentThreads[thread.id].resolved = true)
                  )
                }
              >
                <Check className="mr-2" /> Resolve
              </Button>
            </div>
          )}
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
