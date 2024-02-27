import React, { useEffect, useRef, useState } from "react";
import { Discussion } from "@/patchwork/schema";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import {
  DiscussionTargetPosition,
  OverlayContainer,
} from "@/tee/codemirrorPlugins/discussionTargetPositionListener";

type CommentPositionMap = Record<string, number>;

interface SpatialCommentsListProps {
  discussions: Discussion[];
  activeDiscussionTargetPositions: DiscussionTargetPosition[];
  overlayContainer: OverlayContainer;
  onChangeCommentPositionMap: (map: CommentPositionMap) => void;
}

const DEBUG_HIGHLIGHT = false;

export const SpatialCommentsList = React.memo(
  ({
    discussions,
    activeDiscussionTargetPositions,
    overlayContainer,
    onChangeCommentPositionMap,
  }: SpatialCommentsListProps) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const scrollContainerRectRef = useRef<DOMRect>();
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement>();
    const commentPositionMapRef = useRef<CommentPositionMap>({});

    const topComment = overlayContainer
      ? activeDiscussionTargetPositions.find(
          ({ y }) => y + overlayContainer.top > 0
        )
      : undefined;

    const triggerChangeCommentPositionMap = () => {
      const commentPositionMapWithScrollOffset = {};

      for (const [id, position] of Object.entries(
        commentPositionMapRef.current
      )) {
        commentPositionMapWithScrollOffset[id] = position - scrollOffset + 20;
      }

      onChangeCommentPositionMap(commentPositionMapWithScrollOffset);
    };

    useEffect(() => {
      triggerChangeCommentPositionMap();
    }, [scrollOffset]);

    // scroll to the current top comment
    useEffect(() => {
      if (!scrollContainer || !topComment) {
        return;
      }

      scrollContainer.scrollTo({
        top: commentPositionMapRef.current[topComment.discussion.id],
        behavior: "smooth",
      });
    }, [topComment, scrollContainer]);

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
            const comment = discussion.comments[0];

            return (
              <div
                className={`p-2 cursor-pointer rounded shadow ${
                  topComment &&
                  topComment.discussion.id === discussion.id &&
                  DEBUG_HIGHLIGHT
                    ? "bg-yellow-100"
                    : "bg-white"
                }`}
                ref={(element) => {
                  if (!element) {
                    delete commentPositionMapRef.current[discussion.id];
                  } else {
                    const rect = element.getBoundingClientRect();
                    commentPositionMapRef.current[discussion.id] =
                      rect.top - overlayContainer.top + scrollOffset;
                  }

                  triggerChangeCommentPositionMap();
                }}
                key={discussion.id}
              >
                <div className="text-gray-600 inline ">
                  <InlineContactAvatar url={comment.contactUrl} size="sm" />
                </div>

                <div className="font-normal">{comment.content}</div>
              </div>
            );
          })}
      </div>
    );
  }
);
