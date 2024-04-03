import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { MarkdownDoc } from "../schema";
import { LoadingScreen } from "../../DocExplorer/components/LoadingScreen";
import { useEffect, useMemo, useRef, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { getCursorSafely, useThreadsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import "../../tee/index.css";
import { DocEditorProps } from "@/DocExplorer/doctypes";
import { MarkdownDocAnchor } from "../schema";
import { getCursorPositionSafely } from "../utils";

export const TinyEssayEditor = ({
  docUrl,
  setSelectedDocAnchors,
  hoveredDocAnchors,
  selectedDocAnchors,
}: DocEditorProps<MarkdownDocAnchor>) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadId, setActiveThreadId] = useState<string | null>();
  const [view, setView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);
  const discussions = useMemo(
    () => (doc?.discussions ? Object.values(doc.discussions) : []),
    [doc?.discussions]
  );

  const docAnchorHighlights = useDocAnchorHighlights({
    doc,
    hoveredDocAnchors,
    selectedDocAnchors,
  });

  const threadsWithPositions = useThreadsWithPositions({
    doc,
    view,
    activeThreadId,
    editorRef,
  });

  // todo: remove from this component and move up to DocExplorer?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  return (
    <div className="h-full overflow-auto" ref={editorRef}>
      <div className="@container flex bg-gray-50 justify-center">
        {/* This has some subtle behavior for responsiveness.
            - We use container queries to adjust the width of the editor based on the size of our container.
            - We get the right line width by hardcoding a max-width and x-padding
            - We take over the full screen on narrow displays (showing comments on mobile is TODO)
         */}
        <div className="bg-white border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4 ">
          <MarkdownEditor
            handle={handle}
            path={["content"]}
            selection={selection}
            setSelection={setSelection}
            setView={setView}
            threadsWithPositions={threadsWithPositions}
            setActiveThreadId={setActiveThreadId}
            docAnchorHighlights={docAnchorHighlights}
            setSelectedDocAnchors={setSelectedDocAnchors}
          />
        </div>
        <div className="w-0">
          <CommentsSidebar
            doc={doc}
            changeDoc={changeDoc}
            selection={selection}
            activeThreadId={activeThreadId}
            setActiveThreadId={setActiveThreadId}
            threadsWithPositions={threadsWithPositions}
          />
        </div>
      </div>
    </div>
  );
};

const useDocAnchorHighlights = ({
  doc,
  hoveredDocAnchors,
  selectedDocAnchors,
}: {
  doc: MarkdownDoc;
  hoveredDocAnchors: MarkdownDocAnchor[];
  selectedDocAnchors: MarkdownDocAnchor[];
}) => {
  return useMemo(() => {
    if (!doc) {
      return [];
    }

    const highlightedDocAnchors = selectedDocAnchors.concat(hoveredDocAnchors);

    return Object.values(doc.discussions).flatMap((discussion) =>
      (discussion.target ?? []).flatMap((anchor) => {
        const fromPos = getCursorPositionSafely(
          doc,
          ["content"],
          anchor.fromCursor
        );
        const toPos = getCursorPositionSafely(
          doc,
          ["content"],
          anchor.toCursor
        );

        if (fromPos === null || toPos === null) {
          return [];
        }

        return [
          {
            ...anchor,
            isActive: highlightedDocAnchors.some((highlighted) =>
              areAnchorsEqual(highlighted, anchor)
            ),
            toPos,
            fromPos,
          },
        ];
      })
    );
  }, [doc?.content, doc?.discussions, hoveredDocAnchors, selectedDocAnchors]);
};

function areAnchorsEqual(
  anchor1: MarkdownDocAnchor,
  anchor2: MarkdownDocAnchor
) {
  anchor1.fromCursor === anchor2.fromCursor &&
    anchor1.toCursor === anchor2.toCursor;
}
