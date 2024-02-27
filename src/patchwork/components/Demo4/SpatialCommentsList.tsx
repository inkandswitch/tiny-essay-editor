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

export const SpatialCommentsList = React.memo(
  ({
    discussions,
    activeDiscussionTargetPositions,
    overlayContainer,
    onChangeCommentPositionMap,
  }: SpatialCommentsListProps) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const containerOffsetRef = useRef<number>();
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
        commentPositionMapWithScrollOffset[id] = position - scrollOffset;
      }

      console.log("triggerChange", commentPositionMapWithScrollOffset);

      onChangeCommentPositionMap(commentPositionMapWithScrollOffset);
    };

    useEffect(() => {
      triggerChangeCommentPositionMap();
    }, [scrollOffset]);

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
          const rect = element.getBoundingClientRect();
          containerOffsetRef.current = rect.top;
        }}
      >
        {discussions &&
          overlayContainer &&
          discussions.map((discussion) => {
            const comment = discussion.comments[0];

            return (
              <div
                className={`p-2 cursor-pointer rounded shadow ${
                  topComment && topComment.discussion.id === discussion.id
                    ? "bg-yellow-100"
                    : "bg-white"
                }`}
                ref={(element) => {
                  if (!element) {
                    delete commentPositionMapRef.current[discussion.id];
                  } else {
                    const rect = element.getBoundingClientRect();
                    commentPositionMapRef.current[discussion.id] =
                      (rect.top + rect.bottom) / 2 -
                      overlayContainer.top +
                      scrollOffset;
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
