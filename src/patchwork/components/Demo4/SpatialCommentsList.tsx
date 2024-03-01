import React, { forwardRef, useEffect, useRef, useState } from "react";
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

// todo: actually listen for size change when animation is running
const SIZE_INCREASE_ON_SELECT = 43;

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
    const [activeReplyDiscussionId, setActiveReplyDiscussionId] =
      useState<string>();
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

    const replyToDiscussion = (discussion: Discussion, content: string) => {
      setActiveReplyDiscussionId(null);

      changeDoc((doc) => {
        doc.discussions[discussion.id].comments.push({
          id: uuid(),
          content,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });
    };

    const resolveDiscussion = (discussion: Discussion) => {
      const index = discussions.findIndex((d) => d.id === discussion.id);
      const nextDiscussion = discussion[index + 1];

      setSelectedDiscussionId(nextDiscussion ? nextDiscussion.id : undefined);

      changeDoc((doc) => {
        doc.discussions[discussion.id].resolved = true;
      });
    };

    useEffect(() => {
      triggerChangeCommentPositionMap();
    }, [scrollOffset, scrollContainer]);

    // sync scrollPosition
    useEffect(() => {
      if (!scrollContainer || !topDiscussion) {
        return;
      }

      if (selectedDiscussionId) {
        const position = commentPositionMapRef.current[selectedDiscussionId];

        if (
          position &&
          (position.top - scrollOffset < 0 ||
            position.bottom - scrollOffset >
              scrollContainerRectRef.current.height)
        ) {
          scrollTo(position.top - SIZE_INCREASE_ON_SELECT); // TODO: find a proper solution
        }

        return;
      }

      scrollTo(commentPositionMapRef.current[topDiscussion.discussion.id].top);
    }, [JSON.stringify(topDiscussion), selectedDiscussionId, scrollContainer]);

    const targetScrollPositionRef = useRef<number>();
    const currentScrollPositionRef = useRef<number>();

    const scrollTo = (pos: number) => {
      const prevTarget = targetScrollPositionRef.current;
      const maxScrollPos =
        scrollContainer.scrollHeight - scrollContainer.clientHeight;

      targetScrollPositionRef.current = Math.min(pos, maxScrollPos);

      if (!prevTarget) {
        triggerScrollPositionUpdate();
      }
    };

    const triggerScrollPositionUpdate = () => {
      const targetPos = targetScrollPositionRef.current;
      const currentPos =
        currentScrollPositionRef.current ?? scrollContainer.scrollTop;

      if (Math.abs(scrollContainer.scrollTop - targetPos) < 1) {
        currentScrollPositionRef.current = undefined;
        targetScrollPositionRef.current = undefined;
        return;
      }

      // todo: maybe we don't even need this logic
      // the scroll position has been shifted manually, abort automatic scroll
      /*if (
        currentPos !== undefined
      ) {
        console.log("abort", currentPos, scrollContainer.scrollTop);
        scrollTargetPositionRef.current = undefined;
        currentScrollPositionRef.current = undefined;
        return;
      }*/

      const nextPosition = (currentPos * 9 + targetPos) / 10;

      scrollContainer.scrollTo({
        top: nextPosition,
      });

      currentScrollPositionRef.current = nextPosition;
      requestAnimationFrame(triggerScrollPositionUpdate);
    };

    // handle keyboard shortcuts
    /*
     * k / ctrl + p / cmd + p : select previous discussion
     * j / ctrl + n / cmd + n: select next discussion
     * cmd + y / ctrl + y: resolve discussion
     * cmd + enter / ctrl + enter : reply
     */
    useEffect(() => {
      if (!selectedDiscussionId) {
        return;
      }

      const onKeydown = (evt: KeyboardEvent) => {
        const currentIndex = discussions.findIndex(
          (discussion) => discussion.id === selectedDiscussionId
        );
        const currentDiscussion = discussions[currentIndex];

        const isMetaOrControlPressed = evt.ctrlKey || evt.metaKey;

        // select previous discussion
        if (evt.key === "k" || (evt.key === "p" && isMetaOrControlPressed)) {
          if (currentIndex > 0) {
            setSelectedDiscussionId(discussions[currentIndex - 1].id);
            evt.preventDefault();
            evt.stopPropagation();
          }

          return;
        }

        // select next discussion
        if (evt.key === "j" || evt.key === "n") {
          if (currentIndex < discussions.length - 1) {
            setSelectedDiscussionId(discussions[currentIndex + 1].id);
            evt.preventDefault();
            evt.stopPropagation();
          }

          return;
        }

        if (evt.key === "y" && isMetaOrControlPressed) {
          resolveDiscussion(currentDiscussion);
          evt.preventDefault();
          evt.stopPropagation();
        }

        if (
          evt.key === "Enter" &&
          isMetaOrControlPressed &&
          !activeReplyDiscussionId
        ) {
          setActiveReplyDiscussionId(selectedDiscussionId);
          evt.preventDefault();
          evt.stopPropagation();
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
        className="bg-gray-50 flex- h-full p-2 flex flex-col gap-2 z-20 m-h-[100%] overflow-y-auto overflow-x-visible"
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
          discussions.map((discussion) => (
            <DiscussionView
              discussion={discussion}
              isReplyBoxOpen={activeReplyDiscussionId === discussion.id}
              setIsReplyBoxOpen={() =>
                setActiveReplyDiscussionId(discussion.id)
              }
              onResolve={() => resolveDiscussion(discussion)}
              onReply={(content) => replyToDiscussion(discussion, content)}
              isHovered={hoveredDiscussionId === discussion.id}
              setIsHovered={(isHovered) =>
                setHoveredDiscussionId(isHovered ? discussion.id : undefined)
              }
              isSelected={selectedDiscussionId === discussion.id}
              setIsSelected={(isSelected) =>
                setSelectedDiscussionId(isSelected ? discussion.id : undefined)
              }
              ref={(element) => {
                if (!element || !scrollContainer) {
                  delete commentPositionMapRef.current[discussion.id];
                } else {
                  const rect = element.getBoundingClientRect();
                  commentPositionMapRef.current[discussion.id] = {
                    top:
                      rect.top -
                      overlayContainer.top +
                      scrollContainer.scrollTop,
                    bottom:
                      rect.bottom -
                      overlayContainer.top +
                      scrollContainer.scrollTop,
                  };
                }

                // triggerChangeCommentPositionMap();
              }}
            />
          ))}
      </div>
    );
  }
);

interface DiscussionViewProps {
  discussion: Discussion;
  isReplyBoxOpen: boolean;
  setIsReplyBoxOpen: () => void;
  onResolve: () => void;
  onReply: (content: string) => void;
  isHovered: boolean;
  setIsHovered: (isHovered: boolean) => void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
}

const DiscussionView = forwardRef<HTMLDivElement, DiscussionViewProps>(
  (
    {
      discussion,
      isReplyBoxOpen,
      setIsReplyBoxOpen,
      onResolve,
      onReply,
      isHovered,
      setIsHovered,
      isSelected,
      setIsSelected,
    }: DiscussionViewProps,
    ref
  ) => {
    const [pendingCommentText, setPendingCommentText] = useState("");

    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsSelected(true)}
        key={discussion.id}
        className={`select-none mr-2 px-2 py-1 border rounded-sm  hover:border-gray-400 bg-white
    ${
      isSelected || isHovered ? "border-gray-400 shadow-xl" : "border-gray-200 "
    }`}
        ref={ref}
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
        <div
          className={`overflow-hidden transition-all ${
            isSelected ? "h-[43px] border-t border-gray-200 pt-2" : "h-[0px]"
          }`}
        >
          <Popover open={isReplyBoxOpen} onOpenChange={setIsReplyBoxOpen}>
            <PopoverTrigger asChild>
              <Button className="mr-2 px-2 h-8" variant="ghost">
                <Reply className="mr-2" /> Reply
                <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Textarea
                className="mb-4"
                value={pendingCommentText}
                onChange={(event) => setPendingCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.metaKey) {
                    onReply(pendingCommentText);
                    setPendingCommentText("");
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
              />

              <PopoverClose>
                <Button
                  variant="outline"
                  onClick={() => {
                    onReply(pendingCommentText);
                    setPendingCommentText("");
                  }}
                >
                  Comment
                  <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
                </Button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            className="select-none h-8 px-2 "
            onClick={() => onResolve()}
          >
            <Check className="mr-2" /> Resolve
            <span className="text-gray-400 ml-2 text-xs">(⌘ + Y)</span>
          </Button>
        </div>
      </div>
    );
  }
);

const DiscusssionCommentView = ({
  comment,
}: {
  comment: DiscussionComment;
}) => {
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
};
