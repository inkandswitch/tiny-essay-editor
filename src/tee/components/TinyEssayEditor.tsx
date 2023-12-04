import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { MarkdownDoc } from "../schema";
import { LoadingScreen } from "../../knapsack/components/LoadingScreen";
import { useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { useThreadsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import "../../tee/index.css";

export const TinyEssayEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadId, setActiveThreadId] = useState<string | null>();
  const [view, setView] = useState<EditorView>();

  const threadsWithPositions = useThreadsWithPositions({
    doc,
    view,
    activeThreadId,
  });

  // todo: remove from this component and move up to knapsack?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  return (
    <div className="@container flex bg-gray-50">
      {/* We use container queries to adjust padding based on the size of our container */}
      {/* this hardcoded width, with padding, gives us the correct line height for essays */}
      <div className="@md:w-4/5 @md:ml-8 @md:mt-4 @md:mr-2 @md:mb-8 max-w-[706px] bg-white p-4 pr-8 border border-gray-200 box-border rounded-md">
        <MarkdownEditor
          handle={handle}
          path={["content"]}
          setSelection={setSelection}
          setView={setView}
          threadsWithPositions={threadsWithPositions}
          setActiveThreadId={setActiveThreadId}
        />
      </div>
      <div className="flex-grow">
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
  );
};
