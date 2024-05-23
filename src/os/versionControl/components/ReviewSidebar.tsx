import { Button } from "@/components/ui/button";
import { DatatypeId } from "@/os/datatypes";
import { useCurrentAccount } from "@/os/explorer/account";
import { ContactAvatar } from "@/os/explorer/components/ContactAvatar";
import { getRelativeTimeString } from "@/os/lib/dates";
import { AnnotationsViewProps, TOOLS } from "@/os/tools";
import {
  AnnotationGroupWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { HasAssets } from "@/tools/essay/assets";
import { MarkdownInput } from "@/tools/essay/components/CodeMirrorEditor";
import { next as A, uuid } from "@automerge/automerge";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { Check, MessageSquare, PencilIcon, XIcon } from "lucide-react";
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { getAnnotationGroupId } from "../annotations";

type ReviewSidebarProps = {
  doc: HasVersionControlMetadata<unknown, unknown> & HasAssets;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown> & HasAssets>;
  datatypeId: DatatypeId;
  selectedAnchors: unknown[];
  annotationGroups: AnnotationGroupWithUIState<unknown, unknown>[];
  setSelectedAnnotationGroupId: (id: string) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
  isCommentInputFocused: boolean;
  setIsCommentInputFocused: (isFocused: boolean) => void;
  setCommentState: (state: CommentState<unknown>) => void;
};

export type PositionMap = Record<string, { top: number; bottom: number }>;

export const ReviewSidebar = React.memo(
  ({
    doc,
    handle,
    datatypeId,
    annotationGroups,
    selectedAnchors,
    setSelectedAnnotationGroupId,
    setHoveredAnnotationGroupId,
    setCommentState,
  }: ReviewSidebarProps) => {
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
                setIsHovered={(isHovered) => {
                  setHoveredAnnotationGroupId(isHovered ? id : undefined);
                }}
                setIsSelected={(isSelected) => {
                  setSelectedAnnotationGroupId(isSelected ? id : undefined);
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
                setCommentState={setCommentState}
                hasNext={index < annotationGroups.length - 1}
                hasPrev={index > 0}
                enableScrollSync
              />
            );
          })}
        </div>

        <div className="bg-gray-50 z-10 px-2 py-4 flex flex-col gap-3 border-b border-gray-200 ">
          <Button
            variant="outline"
            onClick={() => {
              setCommentState({
                type: "create",
                target:
                  selectedAnchors.length > 0 ? selectedAnchors : undefined,
              });
            }}
          >
            Comment {selectedAnchors.length > 0 ? "on selection" : ""}
            <span className="text-gray-400 ml-2 text-xs">(⌘ + shift + m)</span>
          </Button>
        </div>
      </div>
    );
  }
);

export interface AnnotationGroupViewProps {
  doc: HasVersionControlMetadata<unknown, unknown> & HasAssets;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown> & HasAssets>;
  datatypeId: DatatypeId;
  annotationGroup: AnnotationGroupWithUIState<unknown, unknown>;
  onSelectNext: () => void;
  onSelectPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  enableScrollSync?: boolean; // todo: this shouldn't be a flag
  setIsHovered: (isHovered: boolean) => void;
  setIsSelected: (isSelected: boolean) => void;
  setCommentState: (state: CommentState<unknown>) => void;
}

export const AnnotationGroupView = forwardRef<
  HTMLDivElement,
  AnnotationGroupViewProps
>(
  (
    {
      doc,
      handle,
      datatypeId,
      annotationGroup,
      setIsHovered,
      setIsSelected,
      hasNext,
      hasPrev,
      onSelectNext,
      onSelectPrev,
      setCommentState,
      enableScrollSync,
    }: AnnotationGroupViewProps,
    ref
  ) => {
    const [height, setHeight] = useState();
    const [isBeingResolved, setIsBeingResolved] = useState(false);
    const localRef = useRef(null); // Use useRef to create a local ref
    const isExpanded = annotationGroup.state === "expanded";
    const isFocused = annotationGroup.state !== "neutral";
    const account = useCurrentAccount();

    const setRef = (element: HTMLDivElement) => {
      localRef.current = element; // Assign the element to the local ref
      // Forward the ref to the parent
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    const onResolveDiscussion = () => {
      handle.change((doc) => {
        doc.discussions[annotationGroup.discussion.id].resolved = true;
      });

      if (hasNext) {
        onSelectNext();
      } else if (hasPrev) {
        onSelectPrev();
      }
    };

    const onStartResolve = () => {
      setHeight(localRef.current.clientHeight);
      // delay, so height is set first for transition
      requestAnimationFrame(() => {
        setIsBeingResolved(true);
      });
    };

    const onReply = () => {
      setCommentState({
        type: "create",
        target: getAnnotationGroupId(annotationGroup),
      });
    };

    const onUpdateCommentContentWithId = (id: string, content: string) => {
      handle.change((doc) => {
        const index = doc.discussions[
          annotationGroup.discussion.id
        ].comments.findIndex((comment) => comment.id === id);

        A.updateText(
          doc,
          [
            "discussions",
            annotationGroup.discussion.id,
            "comments",
            index,
            "content",
          ],
          content
        );
      });
    };

    const addCommentToAnnotationGroup = (content: string) => {
      handle.change((doc) => {
        let discussions = doc.discussions;

        // convert docs without discussions
        if (!discussions) {
          doc.discussions = {};
          discussions = doc.discussions;
        }

        let discussionId = annotationGroup.discussion?.id;

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
          //setIsReplyBoxOpen(true);
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
      if (isExpanded && enableScrollSync) {
        localRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [isExpanded, enableScrollSync]);

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
                : annotationGroup.state === "focused"
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
              <DiscussionCommentView
                contactUrl={comment.contactUrl}
                timestamp={comment.timestamp}
                content={comment.content}
                key={comment.id}
                docWithAssetsHandle={handle}
                onChangeContent={(content) =>
                  onUpdateCommentContentWithId(comment.id, content)
                }
                isBeingEdited={
                  annotationGroup.comment?.type === "edit" &&
                  annotationGroup.comment?.commentId === comment.id
                }
                setIsBeingEdited={(isBeingEdited) =>
                  setCommentState(
                    isBeingEdited
                      ? { type: "edit", commentId: comment.id }
                      : undefined
                  )
                }
              />
            ))}

            {annotationGroup.comment?.type === "create" && (
              <DiscussionCommentView
                contactUrl={account?.contactHandle.url}
                docWithAssetsHandle={handle}
                onChangeContent={(content) => {
                  setCommentState(undefined);
                  addCommentToAnnotationGroup(content);
                }}
                isBeingEdited={true}
                setIsBeingEdited={() => {
                  setCommentState(undefined);
                }}
              />
            )}
          </div>

          <div
            className={`overflow-hidden transition-all flex items-center gap-2 ${
              isExpanded && !annotationGroup.comment
                ? "h-[43px] opacity-100 mt-2"
                : "h-[0px] opacity-0"
            }`}
          >
            <Button
              variant="ghost"
              className="select-none px-2 flex flex-col w-fi"
              onClick={onReply}
            >
              <div className="flex text-gray-600 gap-2">
                <MessageSquare size={16} /> Reply
              </div>
              <span className="text-gray-400 text-xs w-full text-center">
                (⌘ + ⏎)
              </span>
            </Button>

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

const DiscussionCommentView = ({
  contactUrl,
  timestamp,
  content = "",
  docWithAssetsHandle,
  onChangeContent,
  isBeingEdited,
  setIsBeingEdited,
}: {
  contactUrl: AutomergeUrl;
  timestamp?: number;
  content?: string;
  onChangeContent: (value: string) => void;
  docWithAssetsHandle: DocHandle<HasAssets>;
  isBeingEdited: boolean;
  setIsBeingEdited: (isBeingEdited: boolean) => void;
}) => {
  const [isBeingHovered, setIsBeingHovered] = useState(false);
  const [updatedText, setUpdatedContent] = useState<string>();
  const account = useCurrentAccount();
  const isOwnComment = account?.contactHandle.url === contactUrl;

  return (
    <div
      className="p-1.5"
      onMouseEnter={() => setIsBeingHovered(true)}
      onMouseLeave={() => setIsBeingHovered(false)}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <ContactAvatar url={contactUrl} showName={true} size="sm" />

          {timestamp !== undefined && (
            <div className="text-xs text-gray-400">
              {getRelativeTimeString(timestamp)}
            </div>
          )}
        </div>

        {isOwnComment && (
          <Button
            variant="ghost"
            size="sm"
            className={!isBeingHovered || isBeingEdited ? "invisible" : ""}
            onClick={() => {
              setIsBeingEdited(true);
              setUpdatedContent(content);
            }}
          >
            <PencilIcon size={14} />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div
          className={`text-sm ${
            isBeingEdited
              ? "border border-1 rounded-sm px-2 border-gray-300"
              : "border-white"
          }`}
          onKeyDown={(event) => {
            // stop navigation key presses from bubbling up
            if (
              event.key === "k" ||
              event.key === "j" ||
              event.key === "p" ||
              event.key === "n"
            ) {
              event.stopPropagation();
            }
          }}
        >
          <MarkdownInput
            value={content}
            onChange={isBeingEdited ? setUpdatedContent : undefined}
            docWithAssetsHandle={docWithAssetsHandle}
          />
        </div>

        {isBeingEdited && (
          <div className="flex gap-1 justify-end">
            <Button
              variant="ghost"
              className="py-0 px-2"
              onClick={() => {
                onChangeContent(updatedText);
                setIsBeingEdited(false);
                setUpdatedContent(undefined);
              }}
            >
              <Check size={16} />
            </Button>

            <Button
              variant="ghost"
              className="py-0 px-2"
              onClick={() => {
                setIsBeingEdited(false);
                setUpdatedContent(undefined);
              }}
            >
              <XIcon size={16} />
            </Button>
          </div>
        )}

        <div className="right"></div>
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
