import React, { useRef, useEffect, useState } from "react";
import { Discussion } from "@/patchwork/schema";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import { OverlayContainer } from "@/tee/codemirrorPlugins/discussionTargetPositionListener";

type CommentPositionMap = Record<string, number>;

interface SpatialCommentsListProps {
  discussions: Discussion[];
  overlayContainer: OverlayContainer;
  onChangeCommentPositionMap: (map: CommentPositionMap) => void;
}

export const SpatialCommentsList = React.memo(
  ({
    discussions,
    overlayContainer,
    onChangeCommentPositionMap,
  }: SpatialCommentsListProps) => {
    const containerOffsetRef = useRef<number>();
    const commentPositionMapRef = useRef<CommentPositionMap>({});

    return (
      <div
        className="bg-gray-50 flex- h-full p-2 flex flex-col gap-2"
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
                className="p-2 cursor-pointer rounded shadow bg-white"
                ref={(element) => {
                  if (!element) {
                    delete commentPositionMapRef.current[discussion.id];
                  } else {
                    const rect = element.getBoundingClientRect();
                    commentPositionMapRef.current[discussion.id] =
                      (rect.top + rect.bottom) / 2 - overlayContainer.top;
                  }

                  onChangeCommentPositionMap({
                    ...commentPositionMapRef.current,
                  });
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
