import { AnnotationGroupWithPosition } from "../utils";

import { MarkdownDoc } from "@/datatypes/markdown";
import { getAnnotationGroupId } from "@/os/versionControl/annotations";
import { AnnotationGroupView } from "@/os/versionControl/components/ReviewSidebar";
import { DocHandle } from "@automerge/automerge-repo";
import { SelectionRange } from "@codemirror/state";

export const CommentsSidebar = ({
  doc,
  handle,
  selection,
  annotationGroupsWithPosition,
  setSelectedAnnotationGroupId,
  setHoveredAnnotationGroupId,
  editComment,
}: {
  doc: MarkdownDoc;
  handle: DocHandle<MarkdownDoc>;
  selection: SelectionRange;
  annotationGroupsWithPosition: AnnotationGroupWithPosition[];
  setSelectedAnnotationGroupId: (id: string) => void;
  setHoveredAnnotationGroupId: (id: string) => void;
  editComment: (commentId: string) => void;
}) => {
  return (
    <div>
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
            />
          </div>
        );
      })}
    </div>
  );
};
