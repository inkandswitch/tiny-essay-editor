import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
} from "react";
import { Discussion, DiscussionComment } from "@/patchwork/schema";
import {
  DiscussionTargetPosition,
  OverlayContainer,
} from "@/tee/codemirrorPlugins/discussionTargetPositionListener";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { getRelativeTimeString, useStaticCallback } from "@/tee/utils";
import { useCurrentAccount } from "@/DocExplorer/account";
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
import { sortBy } from "lodash";

interface SpatialCommentsListProps {
  discussions: Discussion[];
  activeDiscussionTargetPositions: DiscussionTargetPosition[];
  overlayContainer: OverlayContainer;
  changeDoc: (changeFn: (doc: MarkdownDoc) => void) => void;
  onChangeCommentPositionMap: (map: PositionMap) => void;
  onChangeScrollOffset: (offset: number) => void;
  setSelectedDiscussionId: (id: string) => void;
  setHoveredDiscussionId: (id: string) => void;
  selectedDiscussionId: string;
  hoveredDiscussionId: string;
}

export const SpatialCommentsList = React.memo(
  ({
    discussions,
    activeDiscussionTargetPositions,
    overlayContainer,
    changeDoc,
    onChangeCommentPositionMap,
    onChangeScrollOffset,
    setSelectedDiscussionId,
    selectedDiscussionId,
    setHoveredDiscussionId,
    hoveredDiscussionId,
  }: SpatialCommentsListProps) => {
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const [activeReplyDiscussionId, setActiveReplyDiscussionId] =
      useState<string>();
    const account = useCurrentAccount();

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
      const nextDiscussion = discussions[index + 1];

      if (nextDiscussion) {
        setSelectedDiscussionId(nextDiscussion?.id);
      } else {
        const prevDiscussion = discussions[index - 1];
        setSelectedDiscussionId(prevDiscussion?.id);
      }

      changeDoc((doc) => {
        doc.discussions[discussion.id].resolved = true;
      });
    };

    const { registerDiscussionElement, discussionsPositionMap } =
      useDiscussionsPositionMap({
        discussions,
        onChangeCommentPositionMap,
        topOffset: 8,
      });

    const topDiscussion = overlayContainer
      ? activeDiscussionTargetPositions.find(
          ({ y }) => y + overlayContainer.top > 0
        )
      : undefined;

    const setScrollTarget = useSetScrollTarget(
      discussionsPositionMap,
      scrollContainer
    );

    // sync scrollPosition
    useEffect(() => {
      if (!scrollContainer || !topDiscussion) {
        return;
      }

      // if there is a new selectedDiscussionId ...
      if (selectedDiscussionId) {
        const position = discussionsPositionMap[selectedDiscussionId];
        const scrollOffset = scrollContainer.scrollTop;

        // scroll into view if it's not vissible
        if (
          position &&
          (position.top - scrollOffset < 0 ||
            position.bottom - scrollOffset > scrollContainer.clientHeight)
        ) {
          setScrollTarget(selectedDiscussionId);
        }

        return;
      }

      setScrollTarget(topDiscussion.discussion.id);
    }, [JSON.stringify(topDiscussion), selectedDiscussionId, scrollContainer]);

    return (
      <div
        onScroll={(evt) =>
          onChangeScrollOffset((evt.target as HTMLDivElement).scrollTop)
        }
        className="bg-gray-50 flex- h-full p-2 flex flex-col z-20 m-h-[100%] overflow-y-auto overflow-x-visible"
        ref={setScrollContainer}
      >
        {discussions &&
          overlayContainer &&
          discussions.map((discussion, index) => (
            <DiscussionView
              key={discussion.id}
              discussion={discussion}
              isReplyBoxOpen={activeReplyDiscussionId === discussion.id}
              setIsReplyBoxOpen={(isOpen) =>
                setActiveReplyDiscussionId(isOpen ? discussion.id : undefined)
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
              ref={(element) =>
                registerDiscussionElement(discussion.id, element)
              }
              onSelectNext={() => {
                const nextDiscussion = discussions[index + 1];
                if (nextDiscussion) {
                  setSelectedDiscussionId(nextDiscussion.id);
                }
              }}
              onSelectPrev={() => {
                const prevDiscussion = discussions[index - 1];
                if (prevDiscussion) {
                  setSelectedDiscussionId(prevDiscussion.id);
                }
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
  setIsReplyBoxOpen: (isOpen: boolean) => void;
  onResolve: () => void;
  onReply: (content: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
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
      onSelectNext,
      onSelectPrev,
    }: DiscussionViewProps,
    ref
  ) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [height, setHeight] = useState();
    const [isBeingResolved, setIsBeingResolved] = useState(false);
    const localRef = useRef(null); // Use useRef to create a local ref

    const setRef = (element: HTMLDivElement) => {
      localRef.current = element; // Assign the element to the local ref
      // Forward the ref to the parent
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const onStartResolve = () => {
      setHeight(localRef.current.clientHeight);
      // delay, so height is set first for transition
      requestAnimationFrame(() => {
        setIsBeingResolved(true);
      });
    };

    // handle keyboard shortcuts
    /*
     * k / ctrl + p / cmd + p : select previous discussion
     * j / ctrl + n / cmd + n: select next discussion
     * cmd + x / ctrl + x : resolve
     * cmd + enter / ctrl + enter : reply
     */
    useEffect(() => {
      if (!isSelected) {
        return;
      }

      const onKeydown = (evt: KeyboardEvent) => {
        const isMetaOrControlPressed = evt.ctrlKey || evt.metaKey;

        // select previous discussion
        if (evt.key === "k" || (evt.key === "p" && isMetaOrControlPressed)) {
          onSelectPrev();
          evt.preventDefault();
          evt.stopPropagation();

          return;
        }

        // select next discussion
        if (evt.key === "j" || evt.key === "n") {
          onSelectNext();
          return;
        }

        if (evt.key === "x" && isMetaOrControlPressed) {
          onStartResolve();
          evt.preventDefault();
          evt.stopPropagation();
        }

        if (evt.key === "Enter" && isMetaOrControlPressed) {
          setIsReplyBoxOpen(true);
          evt.preventDefault();
          evt.stopPropagation();
        }
      };

      window.addEventListener("keydown", onKeydown);

      return () => {
        window.removeEventListener("keydown", onKeydown);
      };
    }, [isSelected]);

    return (
      <div
        ref={setRef}
        className={`pt-2 transition-all ${
          isBeingResolved ? "overflow-hidden" : ""
        }`}
        style={
          height !== undefined
            ? {
                height: isBeingResolved ? "0" : `${height}px`,
              }
            : undefined
        }
        onTransitionEnd={() => {
          if (isBeingResolved) {
            onResolve();
          }
        }}
      >
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsSelected(true)}
          key={discussion.id}
          className={`select-none mr-2 px-2 py-1 border rounded-sm  hover:border-gray-400 bg-white
    ${
      isSelected || isHovered ? "border-gray-400 shadow-xl" : "border-gray-200 "
    }`}
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
                  onChange={(event) =>
                    setPendingCommentText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter" && event.metaKey) {
                      onReply(pendingCommentText);
                      setPendingCommentText("");
                      event.preventDefault();
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
              onClick={() => onStartResolve()}
            >
              <Check className="mr-2" /> Resolve
              <span className="text-gray-400 ml-2 text-xs">(⌘ + X)</span>
            </Button>
          </div>
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

type PositionMap = Record<string, { top: number; bottom: number }>;

interface UseDiscussionsPositionMapResult {
  registerDiscussionElement: (
    discussionId: string,
    element: HTMLDivElement
  ) => void;
  discussionsPositionMap: PositionMap;
}

interface UseDiscussionPositionOptions {
  discussions: Discussion[];
  onChangeCommentPositionMap?: (map: PositionMap) => void;
  topOffset?: number;
}

const useDiscussionsPositionMap = ({
  discussions,
  onChangeCommentPositionMap,
  topOffset = 0,
}: UseDiscussionPositionOptions): UseDiscussionsPositionMapResult => {
  const elementByDiscussionId = useRef(new Map<HTMLDivElement, string>());
  const discussionIdByElement = useRef(new Map<HTMLDivElement, string>());
  const elementSizes = useRef<Record<string, number>>({});
  // create an artificial dependency that triggeres a re-eval of effects / memos
  // that depend on it when forceChange is called
  const [forceChangeDependency, forceChange] = useReducer(() => ({}), {});
  const [resizeObserver] = useState(
    () =>
      new ResizeObserver((events) => {
        for (const event of events) {
          const discussionId = discussionIdByElement.current.get(
            event.target as HTMLDivElement
          );
          elementSizes.current[discussionId] = event.borderBoxSize[0].blockSize;
        }

        forceChange();
      })
  );

  // cleanup resize observer
  useEffect(() => {
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const registerDiscussionElement = (
    discussionId: string,
    element?: HTMLDivElement
  ) => {
    const prevElement = elementByDiscussionId.current[discussionId];
    if (prevElement) {
      resizeObserver.unobserve(prevElement);
      discussionIdByElement.current.delete(prevElement);
      delete elementByDiscussionId.current[discussionId];
    }

    if (element) {
      resizeObserver.observe(element);
      elementByDiscussionId.current[discussionId];
      discussionIdByElement.current.set(element, discussionId);
    }
  };

  const discussionsPositionMap = useMemo(() => {
    let currentPos = topOffset;
    const positionMap = {};

    for (const discussion of discussions) {
      const top = currentPos;
      const bottom = top + elementSizes.current[discussion.id];

      positionMap[discussion.id] = { top, bottom };
      currentPos = bottom;
    }

    if (onChangeCommentPositionMap) {
      onChangeCommentPositionMap(positionMap);
    }
    return positionMap;
  }, [discussions, forceChangeDependency, topOffset]);

  return { registerDiscussionElement, discussionsPositionMap };
};

export const useSetScrollTarget = (
  positionMap: PositionMap,
  scrollContainer: HTMLDivElement
) => {
  const targetIdRef = useRef<string>();

  const triggerScrollPositionUpdate = useStaticCallback(() => {
    const maxScrollPos =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    const targetPos = positionMap[targetIdRef.current]?.top;

    // abort, if target no longer exists
    if (targetPos === undefined) {
      return;
    }

    const scrollToPos = Math.min(maxScrollPos, targetPos);

    // hack: for some reason the scrolling get's stuck when it's close to the target but not quite
    // haven't figured out yet why this is happening
    if (Math.abs(scrollContainer.scrollTop - scrollToPos) < 5) {
      scrollContainer.scrollTo({
        top: scrollToPos,
        behavior: "instant",
      });
      targetIdRef.current = undefined;
      return;
    }

    // incrementally converge towards scrollToPos
    const nextPosition = (scrollContainer.scrollTop * 9 + scrollToPos) / 10;

    scrollContainer.scrollTo({
      top: nextPosition,
      behavior: "instant",
    });

    requestAnimationFrame(triggerScrollPositionUpdate);
  });

  useEffect(() => {
    if (scrollContainer && targetIdRef.current !== undefined) {
      triggerScrollPositionUpdate();
    }
  }, [scrollContainer]);

  return (discussionId: string) => {
    const prevTarget = targetIdRef.current;

    targetIdRef.current = discussionId;

    if (!prevTarget && scrollContainer) {
      triggerScrollPositionUpdate();
    }
  };
};
