import React, { useEffect, useRef, useState } from "react";
import { Discussion, DiscussionComment } from "@/patchwork/schema";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import {
  DiscussionTargetPosition,
  OverlayContainer,
} from "@/tee/codemirrorPlugins/discussionTargetPositionListener";
import { useDocument } from "@/useDocumentVendored";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { getRelativeTimeString } from "@/tee/utils";
import { ContactDoc, useCurrentAccount } from "@/DocExplorer/account";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Reply } from "lucide-react";
import { MarkdownDoc } from "@/tee/schema";
import { uuid } from "@automerge/automerge";

type CommentPositionMap = Record<string, { top: number; bottom: number }>;

interface SpatialCommentsListProps {
  discussions: Discussion[];
  activeDiscussionTargetPositions: DiscussionTargetPosition[];
  overlayContainer: OverlayContainer;
  changeDoc: (changeFn: (doc: MarkdownDoc) => void) => void;
  onChangeCommentPositionMap: (map: CommentPositionMap) => void;
  setSelectedDiscussionId: (id: string) => void;
  setHoveredDiscussionId: (id: string) => void;
  selectedDiscussionId: string;
  hoveredDiscussionId: string;
}

const DEBUG_HIGHLIGHT = false;
const ANCHOR_OFFSET = 20;

export const SpatialCommentsList = React.memo(
  ({
    discussions,
    activeDiscussionTargetPositions,
    overlayContainer,
    changeDoc,
    onChangeCommentPositionMap,
    setSelectedDiscussionId,
    selectedDiscussionId,
    setHoveredDiscussionId,
    hoveredDiscussionId,
  }: SpatialCommentsListProps) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const scrollContainerRectRef = useRef<DOMRect>();
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const commentPositionMapRef = useRef<CommentPositionMap>({});
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [activeReplyThreadId, setActiveReplyThreadId] = useState<string>();
    const account = useCurrentAccount();

    const topDiscussion = overlayContainer
      ? activeDiscussionTargetPositions.find(
          ({ y }) => y + overlayContainer.top > 0
        )
      : undefined;

    const triggerChangeCommentPositionMap = () => {
      const commentPositionMapWithScrollOffset = {};

      for (const [id, position] of Object.entries(
        commentPositionMapRef.current
      )) {
        commentPositionMapWithScrollOffset[id] = {
          top: position.top - scrollOffset,
          bottom: position.bottom - scrollOffset,
        };
      }

      onChangeCommentPositionMap(commentPositionMapWithScrollOffset);
    };

    const replyToDiscussion = (discussion: Discussion) => {
      changeDoc((doc) => {
        doc.discussions[discussion.id].comments.push({
          id: uuid(),
          content: pendingCommentText,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });
    };

    const resolveDiscussion = (discussion: Discussion) => {
      console.log("resolve discussion");
      changeDoc((doc) => {
        doc.discussions[discussion.id].resolved = true;
      });
    };

    useEffect(() => {
      triggerChangeCommentPositionMap();
    }, [scrollOffset]);

    // sync scrollPosition
    useEffect(() => {
      if (!scrollContainer || !topDiscussion) {
        return;
      }

      if (selectedDiscussionId) {
        const position = commentPositionMapRef.current[selectedDiscussionId];

        if (
          position.top - scrollOffset < 0 ||
          position.bottom - scrollOffset > scrollContainerRectRef.current.height
        ) {
          scrollContainer.scrollTo({
            top: position.top,
            behavior: "smooth",
          });
        }

        return;
      }

      scrollContainer.scrollTo({
        top: commentPositionMapRef.current[topDiscussion.discussion.id].top,
        behavior: "smooth",
      });
    }, [topDiscussion, scrollContainer]);

    // handle navigation shortcuts
    useEffect(() => {
      if (!selectedDiscussionId) {
        return;
      }

      const onKeydown = (evt: KeyboardEvent) => {
        console.log(evt);

        const currentIndex = discussions.findIndex(
          (discussion) => discussion.id === selectedDiscussionId
        );

        if (evt.key === "k" || (evt.key === "p" && evt.ctrlKey)) {
          if (currentIndex > 0) {
            setSelectedDiscussionId(discussions[currentIndex - 1].id);
            evt.preventDefault();
            evt.stopPropagation();
          }

          return;
        }

        if (evt.key === "j" || (evt.key === "n" && evt.ctrlKey)) {
          if (currentIndex < discussions.length - 1) {
            setSelectedDiscussionId(discussions[currentIndex + 1].id);
            evt.preventDefault();
            evt.stopPropagation();
          }

          return;
        }
      };

      window.addEventListener("keydown", onKeydown);

      return () => {
        window.removeEventListener("keydown", onKeydown);
      };
    }, [selectedDiscussionId]);

    return (
      <div
        onScroll={(evt) =>
          setScrollOffset((evt.target as HTMLDivElement).scrollTop)
        }
        className="bg-gray-50 flex- h-full p-2 flex flex-col gap-2 overflow-auto"
        ref={(element) => {
          if (!element) {
            return;
          }
          setScrollContainer(element);
          scrollContainerRectRef.current = element.getBoundingClientRect();
        }}
      >
        {discussions &&
          overlayContainer &&
          discussions.map((discussion) => {
            return (
              <div
                onMouseEnter={() => setHoveredDiscussionId(discussion.id)}
                onMouseLeave={() => {
                  setHoveredDiscussionId(undefined);
                }}
                onClick={() => setSelectedDiscussionId(discussion.id)}
                key={discussion.id}
                className={`select-none mr-2 px-2 py-1 border rounded-sm hover:bg-gray-50  hover:border-gray-400              
                ${
                  topDiscussion &&
                  topDiscussion.discussion.id === discussion.id &&
                  DEBUG_HIGHLIGHT
                    ? "bg-yellow-100"
                    : "bg-white"
                }
                ${
                  discussion.id === hoveredDiscussionId ||
                  discussion.id === selectedDiscussionId
                    ? "border-gray-400"
                    : "border-gray-200 "
                }`}
                ref={(element) => {
                  if (!element) {
                    delete commentPositionMapRef.current[discussion.id];
                  } else {
                    const rect = element.getBoundingClientRect();
                    commentPositionMapRef.current[discussion.id] = {
                      top: rect.top - overlayContainer.top + scrollOffset,
                      bottom: rect.bottom - overlayContainer.top + scrollOffset,
                    };
                  }

                  // triggerChangeCommentPositionMap();
                }}
              >
                <div>
                  {discussion.comments.map((comment, index) => (
                    <div
                      key={comment.id}
                      className={
                        index !== discussion.comments.length - 1
                          ? "border-b border-gray-200"
                          : ""
                      }
                    >
                      <DiscusssionCommentView comment={comment} />
                    </div>
                  ))}
                </div>
                <div className="mt-1">
                  <Popover
                    open={activeReplyThreadId === discussion.id}
                    onOpenChange={(open) => {
                      open
                        ? setActiveReplyThreadId(discussion.id)
                        : setActiveReplyThreadId(null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button className="mr-2 px-2 h-8" variant="outline">
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
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && event.metaKey) {
                            replyToDiscussion(discussion);
                            event.preventDefault();
                          }
                        }}
                      />

                      <PopoverClose>
                        <Button
                          variant="outline"
                          onClick={() => replyToDiscussion(discussion)}
                        >
                          Comment
                          <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                        </Button>
                      </PopoverClose>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    className="select-none h-8 px-2 "
                    onClick={() => resolveDiscussion(discussion)}
                  >
                    <Check className="mr-2" /> Resolve
                  </Button>
                </div>
              </div>
            );
          })}
      </div>
    );
  }
);

function DiscusssionCommentView({ comment }: { comment: DiscussionComment }) {
  return (
    <div>
      <div className="flex items-center justify-between p-1.5 text-sm">
        <div className="">
          <ContactAvatar url={comment.contactUrl} showName={true} size="sm" />
        </div>

        <div className="text-xs text-gray-400">
          {getRelativeTimeString(comment.timestamp)}
        </div>
      </div>

      <div className="p-1.5">
        <p>{comment.content}</p>
      </div>
    </div>
  );
}
