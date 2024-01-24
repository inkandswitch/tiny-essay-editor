import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { DiffStyle, MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { MarkdownDoc } from "../schema";
import { LoadingScreen } from "../../DocExplorer/components/LoadingScreen";
import { useRef, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { useThreadsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import "../../tee/index.css";
import { Heads, Patch, view } from "@automerge/automerge/next";

export const TinyEssayEditor = ({
  docUrl,
  docHeads,
  diff,
  readOnly,
  diffStyle,
  foldRanges,
  showDiffAsComments,
}: {
  docUrl: AutomergeUrl;
  docHeads?: Heads;
  diff?: Patch[];
  readOnly?: boolean;
  diffStyle?: DiffStyle;
  foldRanges?: { from: number; to: number }[];
  showDiffAsComments?: boolean;
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadIds, setActiveThreadIds] = useState<string[]>([]);
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  const threadsWithPositions = useThreadsWithPositions({
    doc,
    view: editorView,
    activeThreadIds,
    editorRef,
    diff: showDiffAsComments ? diff : undefined,
  });

  // todo: remove from this component and move up to DocExplorer?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  const docAtHeads = docHeads ? view(doc, docHeads) : doc;
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
            setSelection={setSelection}
            setView={setEditorView}
            threadsWithPositions={threadsWithPositions}
            setActiveThreadIds={setActiveThreadIds}
            readOnly={readOnly ?? false}
            docHeads={docHeads}
            diff={diff}
            diffStyle={diffStyle ?? "normal"}
            foldRanges={foldRanges}
          />
        </div>
        <div className="w-0">
          <CommentsSidebar
            doc={docAtHeads}
            changeDoc={changeDoc}
            selection={selection}
            selectedThreadIds={activeThreadIds}
            setSelectedThreadIds={setActiveThreadIds}
            threadsWithPositions={threadsWithPositions}
            diff={diff}
          />
        </div>
      </div>
    </div>
  );
};
