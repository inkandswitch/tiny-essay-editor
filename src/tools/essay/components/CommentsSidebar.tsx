import * as A from "@automerge/automerge/next";
import { AnnotationGroupWithPosition } from "../utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MarkdownDoc, MarkdownDocAnchor } from "@/datatypes/markdown";
import { getAnnotationGroupId } from "@/os/versionControl/annotations";
import { AnnotationGroupView } from "@/os/versionControl/components/ReviewSidebar";
import { DocHandle } from "@automerge/automerge-repo";
import { MessageCircle } from "lucide-react";
import { TextSelection } from "./CodeMirrorEditor";

export const CommentsSidebar = ({
  doc,
  handle,
  selection,
  hasEditorFocus,
  annotationGroupsWithPosition,
  setSelectedAnnotationGroupId,
  setHoveredAnnotationGroupId,
  editComment,
  createComment,
}: {
  doc: MarkdownDoc;
  handle: DocHandle<MarkdownDoc>;
  selection: TextSelection;
  hasEditorFocus: boolean;
  annotationGroupsWithPosition: AnnotationGroupWithPosition[];
  setSelectedAnnotationGroupId: (id: string) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
  editComment: (commentId: string) => void;
  createComment: (target: string | MarkdownDocAnchor[]) => void;
}) => {
  return (
    <div className="relative">
      {annotationGroupsWithPosition.map((annotationGroup, index) => {
        const id = getAnnotationGroupId(annotationGroup);

        return (
          <div
            key={id}
            className={`absolute transition-all ease-in-out w-[350px] ${
              annotationGroup.state === "expanded"
                ? "z-50 shadow-sm border-gray-500"
                : "z-0"
            }`}
            style={{
              top: annotationGroup.yCoord,
            }}
          >
            <AnnotationGroupView
              doc={doc}
              handle={handle}
              annotationGroup={annotationGroup}
              datatypeId="essay"
              setIsHovered={(isHovered) => {
                setHoveredAnnotationGroupId(isHovered ? id : undefined);
              }}
              setIsSelected={(isSelected) => {
                setSelectedAnnotationGroupId(isSelected ? id : undefined);
              }}
              onSelectNext={() => {
                const nextAnnotation = annotationGroupsWithPosition[index + 1];
                if (nextAnnotation) {
                  setSelectedAnnotationGroupId(
                    getAnnotationGroupId(nextAnnotation)
                  );
                }
              }}
              onSelectPrev={() => {
                const prevAnnotation = annotationGroupsWithPosition[index - 1];
                if (prevAnnotation) {
                  setSelectedAnnotationGroupId(
                    getAnnotationGroupId(prevAnnotation)
                  );
                }
              }}
              hasNext={index < annotationGroupsWithPosition.length - 1}
              hasPrev={index > 0}
              editComment={editComment}
              createComment={createComment}
            />
          </div>
        );
      })}

      {selection && selection.from !== selection.to && hasEditorFocus && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger
              className="absolute"
              style={{
                top: selection.yCoord + 24,
                left: -60,
              }}
              asChild
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // todo: remove this once cursors can point to sides of characters
                  // can't point after last character so we use the last character instead
                  const to = Math.min(doc.content.length - 1, selection.to);

                  createComment([
                    {
                      fromCursor: A.getCursor(doc, ["content"], selection.from),
                      toCursor: A.getCursor(doc, ["content"], to),
                    },
                  ]);
                }}
              >
                <MessageCircle size={20} className="text-gray-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex gap-2">
              <span>comment</span>
              <span className="text-gray-400 text-xs">(⌘ + shift + M)</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
