import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { DATA_TYPES, DatatypeId } from "@/os/datatypes";
import { useCurrentAccount } from "@/os/explorer/account";
import { ContactAvatar } from "@/os/explorer/components/ContactAvatar";
import { getRelativeTimeString } from "@/os/lib/dates";
import { AnnotationsViewProps, TOOLS } from "@/os/tools";
import {
  AnnotationGroup,
  AnnotationGroupWithState,
  DiscussionComment,
  HasVersionControlMetadata,
  HighlightAnnotation,
} from "@/os/versionControl/schema";
import { next as A, uuid } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { Check, MessageCircleIcon } from "lucide-react";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { getAnnotationGroupId } from '../annotations.js';

type ReviewSidebarProps = {
  doc: HasVersionControlMetadata<unknown, unknown>;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown>>;
  datatypeId: DatatypeId;
  annotationGroups: AnnotationGroupWithState<unknown, unknown>[];
  selectedAnchors: unknown[];
  changeDoc: (
    changeFn: (doc: HasVersionControlMetadata<unknown, unknown>) => void
  ) => void;
  onChangeCommentPositionMap: (map: PositionMap) => void;
  setSelectedAnnotationGroupId: (id: string) => void;
  hoveredAnnotationGroupId: string | undefined;
  setHoveredAnnotationGroupId: (id: string) => void;
  isCommentInputFocused: boolean;
  setIsCommentInputFocused: (isFocused: boolean) => void;
};

export type PositionMap = Record<string, { top: number; bottom: number }>;

export const ReviewSidebar = React.memo(
  ({
    doc,
    handle,
    datatypeId,
    annotationGroups,
    selectedAnchors,
    changeDoc,
    setSelectedAnnotationGroupId,
    hoveredAnnotationGroupId,
    setHoveredAnnotationGroupId,
    isCommentInputFocused,
    setIsCommentInputFocused,
  }: ReviewSidebarProps) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [annotationGroupIdOfActiveReply, setAnnotationGroupIdOfActiveReply] =
      useState<string>();
    const account = useCurrentAccount();

    const pendingAnnotationsForComment: HighlightAnnotation<
      unknown,
      unknown
    >[] = useMemo(() => {
      if (!doc) return [];
      const valueOfAnchor =
        DATA_TYPES[datatypeId].valueOfAnchor ?? (() => null);
      return selectedAnchors.map((anchor) => ({
        type: "highlighted",
        anchor: [anchor],
        value: valueOfAnchor(doc, anchor),
      }));
    }, [selectedAnchors, doc, datatypeId]);

    const addCommentToAnnotationGroup = (
      annotationGroup: AnnotationGroup<unknown, unknown>,
      content: string
    ) => {
      setAnnotationGroupIdOfActiveReply(undefined);

      changeDoc((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        let discussionId = annotationGroup?.discussion?.id;

        if (!discussionId) {
          discussionId = uuid();
          discussions[discussionId] = {
            id: discussionId,
            heads: A.getHeads(doc),
            comments: [],
            resolved: false,
            anchors: annotationGroup.annotations.map(
              (annotation) => annotation.anchor
            ),
          };
        }

        discussions[discussionId].comments.push({
          id: uuid(),
          content,
          contactUrl: account.contactHandle.url,
          timestamp: Date.now(),
        });
      });
    };

    const createDiscussion = (content: string) => {
      setPendingCommentText("");

      const discussionId = uuid();

      changeDoc((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        discussions[discussionId] = {
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
          anchors: selectedAnchors,
        };
      });

      setSelectedAnnotationGroupId(discussionId);
    };

    const resolveDiscussionAtIndex = (index: number) => {
      const discussionGroup = annotationGroups[index];

      let newSelectedAnnotationGroupId;

      const nextAnnotation = annotationGroups[index + 1];
      if (nextAnnotation) {
        newSelectedAnnotationGroupId = getAnnotationGroupId(nextAnnotation);
      } else {
        const prevAnnotation = annotationGroups[index - 1];
        if (prevAnnotation) {
          newSelectedAnnotationGroupId = getAnnotationGroupId(prevAnnotation);
        }
      }

      setSelectedAnnotationGroupId(newSelectedAnnotationGroupId);

      changeDoc((doc) => {
        doc.discussions[discussionGroup.discussion.id].resolved = true;
      });
    };

    return (
      <div className="h-full flex flex-col">
        <div className="bg-gray-50 flex-1 p-2 flex flex-col z-20 m-h-[100%] overflow-y-auto overflow-x-visible">
          {annotationGroups.map((annotationGroup, index) => {
            const id = getAnnotationGroupId(annotationGroup);
            return (
              <AnnotationGroupView
                doc={doc}
                handle={handle}
                datatypeId={datatypeId}
                key={id}
                annotationGroup={annotationGroup}
                isReplyBoxOpen={annotationGroupIdOfActiveReply === id}
                setIsReplyBoxOpen={(isOpen) => {
                  setAnnotationGroupIdOfActiveReply(isOpen ? id : undefined);
                }}
                onResolveDiscussion={() => resolveDiscussionAtIndex(index)}
                onAddComment={(content) => {
                  addCommentToAnnotationGroup(annotationGroup, content);
                }}
                isHovered={hoveredAnnotationGroupId === id}
                setIsHovered={(isHovered) => {
                  setHoveredAnnotationGroupId(isHovered ? id : undefined);
                }}
                setIsSelected={(isSelected) => {
                  setSelectedAnnotationGroupId(isSelected ? id : undefined);
                }}
                ref={(element) => {
                  /*registerAnnotationElement(
                    JSON.stringify(annotation.target),
                    element
                  )*/
                }}
                onSelectNext={() => {
                  const nextAnnotation = annotationGroups[index + 1];
                  if (nextAnnotation) {
                    setSelectedAnnotationGroupId(
                      getAnnotationGroupId(nextAnnotation)
                    );
                  }
                }}
                onSelectPrev={() => {
                  const prevAnnotation = annotationGroups[index - 1];
                  if (prevAnnotation) {
                    setSelectedAnnotationGroupId(
                      getAnnotationGroupId(prevAnnotation)
                    );
                  }
                }}
              />
            );
          })}
        </div>
        <div className="bg-gray-50 z-10 px-2 py-4 flex flex-col gap-3 border-t border-gray-400 ">
          {/* We only want to show the AnnotationsView when the comment input is focused.
              But we can't let it mount/unmount because then some viewers (eg TLDraw will steal
              focus from the comment input. So instead we leave it in the UI tree, but hidden */}
          <div
            className={`${
              isCommentInputFocused ? "opacity-100" : "h-0 overflow-hidden"
            }`}
          >
            <AnnotationsView
              doc={doc}
              handle={handle}
              datatypeId={datatypeId}
              annotations={pendingAnnotationsForComment}
            />
          </div>

          <Textarea
            value={pendingCommentText}
            onChange={(event) => setPendingCommentText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.metaKey) {
                createDiscussion(pendingCommentText);
                event.preventDefault();
              }
              event.stopPropagation();
            }}
            onFocus={() => setIsCommentInputFocused(true)}
            onBlur={() => setIsCommentInputFocused(false)}
          />

          <Button
            variant="outline"
            onClick={() => {
              createDiscussion(pendingCommentText);
            }}
          >
            Comment
            <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
          </Button>
        </div>
      </div>
    );
  }
);

export interface AnnotationGroupViewProps {
  doc: HasVersionControlMetadata<unknown, unknown>;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown>>;
  datatypeId: DatatypeId;
  annotationGroup: AnnotationGroupWithState<unknown, unknown>;
  isReplyBoxOpen: boolean;
  setIsReplyBoxOpen: (isOpen: boolean) => void;
  onResolveDiscussion: () => void;
  onAddComment: (content: string) => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  isHovered: boolean;
  setIsHovered: (isHovered: boolean) => void;
  setIsSelected: (isSelected: boolean) => void;
}

const AnnotationGroupView = forwardRef<
  HTMLDivElement,
  AnnotationGroupViewProps
>(
  (
    {
      doc,
      handle,
      datatypeId,
      annotationGroup,
      isReplyBoxOpen,
      setIsReplyBoxOpen,
      onResolveDiscussion,
      onAddComment: onReply,
      isHovered,
      setIsHovered,
      setIsSelected,
      onSelectNext,
      onSelectPrev,
    }: AnnotationGroupViewProps,
    ref
  ) => {
    const [pendingCommentText, setPendingCommentText] = useState("");
    const [height, setHeight] = useState();
    const [isBeingResolved, setIsBeingResolved] = useState(false);
    const localRef = useRef(null); // Use useRef to create a local ref
    const isExpanded = annotationGroup.state === "expanded";
    const isFocused = annotationGroup.state !== "neutral";

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
      if (!isExpanded) {
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
    }, [isExpanded, onSelectNext, onSelectPrev]);

    // Scroll this annotation group into view when it's expanded.
    // This handles two distinct interactions:
    // 1) when the annotation group is selected from within a doc editor,
    //    the sidebar scrolls to make it visible
    // 2) When the user selects an annotation group within the sidebar,
    //    this ensures that the entire annotation group is made visible.
    //    If it's already fully visible nothing happens; but if it's only
    //    partially visible then this makes it fully visible.
    useEffect(() => {
      if (isExpanded) {
        localRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [isExpanded]);

    return (
      <div
        onClick={(event) => event.stopPropagation()}
        ref={setRef}
        className={`pt-2 transition-all cursor-default ${
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
            onResolveDiscussion();
          }
        }}
      >
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setIsSelected(true)}
          className="flex flex-col gap-1"
        >
          <div
            className={`flex flex-col gap-1 bg-white rounded-sm p-2 border-2 ${
              isFocused
                ? "border-blue-600 shadow-lg"
                : isHovered
                ? "border-blue-600 shadow-lg"
                : "border border-gray-200 "
            }`}
          >
            <AnnotationsView
              doc={doc}
              handle={handle}
              datatypeId={datatypeId}
              annotations={annotationGroup.annotations}
            />

            {annotationGroup.discussion?.comments.map((comment, index) => (
              <DiscussionCommentView comment={comment} key={comment.id} />
            ))}
          </div>

          <div
            className={`overflow-hidden transition-all flex items-center gap-2 ${
              isExpanded ? "h-[43px] opacity-100 mt-2" : "h-[0px] opacity-0"
            }`}
          >
            <Popover
              open={isReplyBoxOpen}
              onOpenChange={(isOpen) => setIsReplyBoxOpen(isOpen)}
            >
              <PopoverTrigger>
                <Button
                  variant="ghost"
                  className="select-none p-2 flex flex-col w-fit"
                  onClick={() => setIsReplyBoxOpen(true)}
                >
                  <div className="flex gap-2 text-gray-600">
                    <MessageCircleIcon size={16} />{" "}
                    {annotationGroup.discussion &&
                    annotationGroup.discussion.comments.length > 0
                      ? "Reply"
                      : "Comment"}
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
                    {annotationGroup.discussion &&
                    annotationGroup.discussion.comments.length > 0
                      ? "Reply"
                      : "Comment"}
                    <span className="text-gray-400 ml-2 text-xs">(⌘ + ⏎)</span>
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>

            {annotationGroup.discussion && (
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
            )}
          </div>
        </div>
      </div>
    );
  }
);

const DiscussionCommentView = ({ comment }: { comment: DiscussionComment }) => {
  return (
    <div className="p-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="">
          <ContactAvatar url={comment.contactUrl} showName={true} size="sm" />
        </div>

        <div className="text-xs text-gray-400">
          {getRelativeTimeString(comment.timestamp)}
        </div>
      </div>

      <div className="text-sm">
        <p>{comment.content}</p>
      </div>
    </div>
  );
};

type AnnotationViewPropsWithDatatypeId<
  D extends HasVersionControlMetadata<T, V>,
  T,
  V
> = AnnotationsViewProps<D, T, V> & {
  datatypeId: DatatypeId;
};

const AnnotationsView = ({
  annotations,
  datatypeId,
  doc,
  handle,
}: AnnotationViewPropsWithDatatypeId<
  HasVersionControlMetadata<unknown, unknown>,
  unknown,
  unknown
>) => {
  // For now, we just use the first annotation viewer available for this doc type.
  // In the future, we might want to:
  // - use an annotations view that's similar to the viewer being used for the main doc
  // - allow switching between different viewers?
  const Viewer = TOOLS[datatypeId]?.[0].annotationViewComponent;
  if (!Viewer) {
    return (
      <div className="text-gray-500 text-xs italic">
        No view available for this edit
      </div>
    );
  }
  return <Viewer doc={doc} handle={handle} annotations={annotations} />;
};
