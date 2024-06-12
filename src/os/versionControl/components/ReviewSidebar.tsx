import { Button } from "@/components/ui/button";
import { Tool } from "@/os/tools";
import {
  AnnotationGroupWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { DocHandle } from "@automerge/automerge-repo";
import React from "react";
import { getAnnotationGroupId } from "../annotations";
import { AnnotationGroupView } from "./AnnotationGroupView";

type ReviewSidebarProps = {
  doc: HasVersionControlMetadata<unknown, unknown>;
  handle: DocHandle<HasVersionControlMetadata<unknown, unknown>>;
  tool: Tool;
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
    tool,
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
                annotationsViewComponent={tool.annotationsViewComponent}
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
