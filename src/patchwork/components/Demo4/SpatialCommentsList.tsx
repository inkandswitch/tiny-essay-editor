import React, { useRef, useEffect, useState } from "react";
import { Discussion } from "@/patchwork/schema";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";

type CommentPositionMap = Record<string, number>;

interface SpatialCommentsListProps {
  bezierCurveLayerElement?: HTMLDivElement;
  activeDiscussions: Discussion[];
  onChangeCommentPositionMap: (map: CommentPositionMap) => void;
}

export const SpatialCommentsList = React.memo(
  ({
    bezierCurveLayerElement,
    activeDiscussions,
    onChangeCommentPositionMap,
  }: SpatialCommentsListProps) => {
    const [offset, setOffset] = useState(0);

    const containerOffsetRef = useRef<number>();
    const commentPositionMapRef = useRef<CommentPositionMap>({});

    useEffect(() => {
      if (!bezierCurveLayerElement) {
        return;
      }

      setOffset(bezierCurveLayerElement.getBoundingClientRect().top);
    }, [bezierCurveLayerElement]);

    return (
      <div
        className="bg-gray-100 flex- h-full p-2 flex flex-col gap-2"
        ref={(element) => {
          if (!element) {
            return;
          }
          const rect = element.getBoundingClientRect();
          containerOffsetRef.current = rect.top;
        }}
      >
        {activeDiscussions &&
          activeDiscussions.map((discussion) => {
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
                      (rect.top + rect.bottom) / 2 - offset;
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
