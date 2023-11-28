import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { LocalSession, MarkdownDoc } from "../schema";
import { Navbar } from "./Navbar";
import { LoadingScreen } from "./LoadingScreen";
import { useEffect, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { useThreadsWithPositions } from "../utils";
import { decodeChange, getAllChanges } from "@automerge/automerge";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [session, setSessionInMemory] = useState<LocalSession>();
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadId, setActiveThreadId] = useState<string | null>();
  const [view, setView] = useState<EditorView>();

  const localStorageKey = `LocalSession-${docUrl}`;

  useEffect(() => {
    const session = localStorage.getItem(localStorageKey);
    if (session) {
      setSessionInMemory(JSON.parse(session));
    } else {
      setSessionInMemory({ userId: null });
    }
  }, [localStorageKey]);

  const setSession = (session: LocalSession) => {
    localStorage.setItem(localStorageKey, JSON.stringify(session));
    setSessionInMemory(session);
  };

  const threadsWithPositions = useThreadsWithPositions({
    doc,
    view,
    activeThreadId,
  });

  if (!doc || !session) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  return (
    <div>
      <div className="fixed z-50 top-0">
        <Navbar
          handle={handle}
          doc={doc}
          changeDoc={changeDoc}
          session={session}
          setSession={setSession}
        />
      </div>

      <div className="mt-16">
        <span>Diff from:</span>
        <input
          type="range"
          min="0"
          max={getAllChanges(handle.docSync()).length - 1}
          onChange={(e) => {
            const change = getAllChanges(handle.docSync())[e.target.value];
            handle.change((doc) => {
              if (doc.uiState === undefined) {
                doc.uiState = { fromHeads: [] };
              }
              doc.uiState.fromHeads = [decodeChange(change).hash];
            });
          }}
        />
      </div>
      <div className="flex bg-gray-50">
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
            session={session}
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
