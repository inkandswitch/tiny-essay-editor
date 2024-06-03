import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownDocEditor, TextSelection } from "./CodeMirrorEditor";

import {
  MarkdownDoc,
  MarkdownDocAnchor,
  ResolvedMarkdownDocAnchor,
} from "@/datatypes/essay";
import { useEffect, useMemo, useState } from "react";

import { EditorView } from "@codemirror/view";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import { EditorProps } from "@/os/tools";
import { AnnotationWithUIState } from "@/os/versionControl/schema";
import { getCursorPositionSafely } from "@/os/versionControl/utils";
import { isEqual, uniq } from "lodash";
import "../index.css";
import { useAnnotationGroupsWithPosition } from "../utils";
import { CommentsSidebar } from "./CommentsSidebar";

export const EssayEditor = (props: EditorProps<MarkdownDocAnchor, string>) => {
  const {
    docUrl,
    docHeads,
    annotations = [],
    annotationGroups = [],
    setSelectedAnchors = () => {},
    actorIdToAuthor,
    hideInlineComments,
    setSelectedAnnotationGroupId,
    setHoveredAnnotationGroupId,
    setCommentState,
  } = props;

  const [hasEditorFocus, setHasEditorFocus] = useState(false);
  const [selection, setSelection] = useState<TextSelection>();
  const [doc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [editorView, setEditorView] = useState<EditorView>();
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement>(null);
  const readOnly = docHeads && !isEqual(docHeads, A.getHeads(doc));

  const [visibleAuthorsForEdits, setVisibleAuthorsForEdits] = useState<
    AutomergeUrl[]
  >([]);

  // If the authors on the doc change, show changes by all authors
  useEffect(() => {
    setVisibleAuthorsForEdits(uniq(Object.values(actorIdToAuthor ?? {})));
  }, [actorIdToAuthor]);

  const resolvedAnnotations = useMemo<
    AnnotationWithUIState<ResolvedMarkdownDocAnchor, string>[]
  >(() => {
    return annotations.flatMap((annotation) => {
      const { fromCursor, toCursor } = annotation.anchor;
      const fromPos = getCursorPositionSafely(doc, ["content"], fromCursor);
      const toPos = getCursorPositionSafely(doc, ["content"], toCursor);

      return fromPos === null || toPos === null
        ? []
        : [
            {
              ...annotation,
              anchor: { fromPos, toPos, fromCursor, toCursor },
            },
          ];
    });
  }, [doc, annotations]);

  const annotationGroupsWithPosition = useAnnotationGroupsWithPosition({
    doc,
    editorView,
    editorContainer,
    annotationGroups,
  });

  if (!doc) {
    return null;
  }

  return (
    <div
      className="h-full overflow-auto min-h-0 w-full scroll-smooth"
      ref={setEditorContainer}
    >
      <div className="@container flex bg-gray-100 justify-center">
        {/* This has some subtle behavior for responsiveness.
            - We use container queries to adjust the width of the editor based on the size of our container.
            - We get the right line width by hardcoding a max-width and x-padding
            - We take over the full screen on narrow displays (showing comments on mobile is TODO)
         */}
        <div className="flex @xl:mt-4 @xl:mr-2 @xl:mb-8 @xl:ml-[-100px] @4xl:ml-[-200px] w-full @xl:w-4/5  max-w-[722px]">
          <div
            className={`w-full bg-white box-border rounded-md px-10 py-4 transition-all duration-500 ${
              readOnly
                ? " border-2 border-dashed border-slate-400"
                : "border border-gray-200 "
            }`}
          >
            <MarkdownDocEditor
              editorContainer={editorContainer}
              handle={handle}
              path={["content"]}
              setSelectedAnchors={setSelectedAnchors}
              setView={setEditorView}
              setSelection={setSelection}
              setHasFocus={setHasEditorFocus}
              annotations={resolvedAnnotations}
              readOnly={readOnly ?? false}
              docHeads={docHeads}
            />
          </div>
        </div>

        <div>
          <CommentsSidebar
            doc={doc}
            hideInlineComments={hideInlineComments}
            handle={handle}
            selection={selection}
            hasEditorFocus={hasEditorFocus}
            annotationGroupsWithPosition={annotationGroupsWithPosition}
            setSelectedAnnotationGroupId={setSelectedAnnotationGroupId}
            setHoveredAnnotationGroupId={setHoveredAnnotationGroupId}
            setCommentState={setCommentState}
          />
        </div>
      </div>
    </div>
  );
};
