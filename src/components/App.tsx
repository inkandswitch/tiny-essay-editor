import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { MarkdownDoc } from "../schema";
import { Navbar } from "./Navbar";
import { LoadingScreen } from "./LoadingScreen";
import { useEffect, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { useThreadsWithPositions } from "../utils";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
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

  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  return (
    <div>
      <div className="fixed z-50 top-0">
        <Navbar handle={handle} doc={doc} />
      </div>

      <div className="flex bg-gray-50 mt-12">
        <div className="w-full md:w-3/5 lg:w-4/5 max-w-[776px] bg-white md:my-4 md:ml-8 lg:ml-16 xl:ml-48 md:mr-4 border border-gray-200 p-4 rounded-sm">
          <MarkdownEditor
            handle={handle}
            path={["content"]}
            setSelection={setSelection}
            setView={setView}
            threadsWithPositions={threadsWithPositions}
            setActiveThreadId={setActiveThreadId}
          />
        </div>
        <div className="flex-grow bg-gray-50">
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
}

export default App;
