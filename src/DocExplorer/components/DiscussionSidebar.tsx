import { useCurrentAccount } from "@/DocExplorer/account";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { getRelativeTimeString } from "@/tee/utils";
import { next as A, uuid } from "@automerge/automerge";
import { Check } from "lucide-react";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Discussion, DiscussionComment, HasDocMetadata } from "../doctypes";

import { MessageCircleIcon } from "lucide-react";

type DiscussionSidebarProps = {
  docType: string;
  doc: HasDocMetadata<unknown>;
  changeDoc: (changeFn: (doc: HasDocMetadata<unknown>) => void) => void;
  setSelectedDocAnchors: (anchors: unknown[]) => void;
  setHoveredDocAnchors: (anchors: unknown[]) => void;
  selectedDocAnchors: unknown[];
  hoveredDocAnchors: unknown[];
};

export const DiscussionSidebar = React.memo(
  ({
    docType,
    doc,
    changeDoc,
    setSelectedDocAnchors,
    setHoveredDocAnchors,
    selectedDocAnchors,
    hoveredDocAnchors,
  }: DiscussionSidebarProps) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [scrollOffset, setScrollOffset] = useState(0);
    const account = useCurrentAccount();
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const scrollContainerRect = useMemo(
      () => scrollContainer?.getBoundingClientRect(),
      [scrollContainer]
    );

    const discussions = useMemo(
      () => (doc?.discussions ? Object.values(doc.discussions) : []),
      [doc.discussions]
    );

    const createDiscussion = (target: unknown[], content: string) => {
      changeDoc((doc) => {
        const discussionId = uuid();

        // convert docs without discussions
        if (!doc.discussions) {
          doc.discussions = {};
        }

        doc.discussions[discussionId] = {
          id: discussionId,
          heads: A.getHeads(doc),
          comments: [
            {
              id: uuid(),
              content,
              contactUrl: account.contactHandle.url,
              timestamp: Date.now(),
            },
          ],
          resolved: false,
          target,
        };
      });

      setSelectedDocAnchors([]);
      setPendingCommentText("");

      console.log("create discussion", target, content);
    };

    const addCommentToDiscussion = (
      discussion: Discussion<unknown>,
      content: string
    ) => {
      changeDoc((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        let discussionId = discussion.id;

        discussions[discussionId].comments.push({
          id: uuid(),
          content,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });

      setPendingCommentText("");
    };

    const resolveDiscussion = (discussion: Discussion<unknown>) => {
      /* const index = annotations.findIndex(
        (annotation) =>
          annotation.discussion && annotation.discussion.id === discussion.id
      );
      const nextAnnotation = annotations[index + 1];

      if (nextAnnotation) {
        setSelectedAnnotations([nextAnnotation]);
      } else {
        const prevAnnotation = annotations[index - 1];
        setSelectedAnnotations([prevAnnotation]);
      } */

      changeDoc((doc) => {
        doc.discussions[discussion.id].resolved = true;
      });
    };

    return (
      <div
        className="h-full flex flex-col"
        onClick={() => {
          /*setSelectedDiscussionId(undefined)*/
        }}
      >
        <div
          ref={setScrollContainer}
          onScroll={(evt) =>
            setScrollOffset((evt.target as HTMLDivElement).scrollTop)
          }
          className="bg-gray-50 flex-1 p-2 flex flex-col z-20 m-h-[100%] overflow-y-auto overflow-x-visible"
        >
          {discussions.map((discussion, index) => {
            return (
              <DiscussionView
                docType={docType}
                key={discussion.id}
                discussion={discussion}
                isReplyBoxOpen={false}
                setIsReplyBoxOpen={(isOpen) => {}}
                onResolve={() => resolveDiscussion(discussion)}
                onAddComment={(content) => {
                  addCommentToDiscussion(discussion, content);
                }}
                isHovered={false}
                setIsHovered={(isHovered) => {
                  /*                  setHoveredAnnotation(isHovered ? annotation : undefined); */
                }}
                isSelected={false}
                setIsSelected={(isSelected) => {
                  /* setSelectedAnnotations(isSelected ? [annotation] : []);*/
                }}
                onSelectNext={() => {
                  /*if (selectedAnnotations.length > 1) {
                    return;
                  }

                  const nextAnnotation = annotations[index + 1];
                  if (nextAnnotation) {
                    setSelectedAnnotations([nextAnnotation]);
                  }*/
                }}
                onSelectPrev={() => {
                  /*const prevAnnotation = annotations[index - 1];
                  if (prevAnnotation) {
                    setSelectedAnnotations([prevAnnotation]);
                  }*/
                }}
              />
            );
          })}
        </div>
        {selectedDocAnchors.length !== 0 && (
          <div className="bg-gray-50 z-10 p-2 flex flex-col gap-2">
            <Textarea
              value={pendingCommentText}
              onChange={(event) => setPendingCommentText(event.target.value)}
              // GL Nov: figure out how to close the popover upon cmd-enter submit
              // GL 12/14: the answer here is going to be to control Popover open
              // state ourselves as we now do elsewhere in the codebase
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.metaKey) {
                  /* startDiscusssionAtSelection(pendingCommentText);
                setSuppressButton(true);
                setIsCommentBoxOpen(false);
                event.preventDefault(); */
                }
              }}
            />

            <Button
              variant="outline"
              onClick={() => {
                createDiscussion(selectedDocAnchors, pendingCommentText);
              }}
            >
              Comment
              <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
            </Button>
          </div>
        )}
      </div>
    );
  }
);

interface DiscussionViewProps {
  docType: string;
  discussion: Discussion<unknown>;
  isReplyBoxOpen: boolean;
  setIsReplyBoxOpen: (isOpen: boolean) => void;
  onResolve: () => void;
  onAddComment: (content: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  isHovered: boolean;
  setIsHovered: (isHovered: boolean) => void;
  isSelected: boolean;
  setIsSelected: (isSelected: boolean) => void;
}

const DiscussionView = forwardRef<HTMLDivElement, DiscussionViewProps>(
  <T, V>(
    {
      docType,
      discussion,
      isReplyBoxOpen,
      setIsReplyBoxOpen,
      onResolve,
      onAddComment: onReply,
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
     * cmd + r / ctrl + r : resolve
     * cmd + enter / ctrl + enter : reply
     * cmd + z / ctrl + z : revert
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

        if (evt.key === "r" && isMetaOrControlPressed) {
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
    }, [isSelected, onSelectNext, onSelectPrev]);

    return (
      <div
        onClick={(event) => event.stopPropagation()}
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
          className="flex flex-col gap-1"
        >
          <div
            className={`flex flex-col gap-1 ${
              isSelected || isHovered
                ? "border bg-white rounded-sm p-2 border-gray-400 shadow-xl"
                : "border bg-white rounded-sm p-2 border-gray-200 "
            }`}
          >
            {discussion.comments.map((comment) => (
              <DiscusssionCommentView comment={comment} key={comment.id} />
            ))}
          </div>

          <div
            className={`overflow-hidden transition-all flex items-center gap-2 ${
              isSelected ? "h-[43px] opacity-100 mt-2" : "h-[0px] opacity-0"
            }`}
          >
            <Popover open={isReplyBoxOpen}>
              <PopoverTrigger>
                <Button
                  variant="ghost"
                  className="select-none p-2 flex flex-col w-fit"
                  onClick={() => setIsReplyBoxOpen(true)}
                >
                  <div className="flex gap-2 text-gray-600">
                    <MessageCircleIcon size={16} /> Comment
                  </div>
                  <span className="text-gray-400 text-xs w-full text-center">
                    (⌘ + ⏎)
                  </span>
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
              className="select-none px-2 flex flex-col w-fi"
              onClick={onStartResolve}
            >
              <div className="flex text-gray-600 gap-2">
                <Check size={16} /> Resolve
              </div>
              <span className="text-gray-400 text-xs w-full text-center">
                (⌘ + R)
              </span>
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
