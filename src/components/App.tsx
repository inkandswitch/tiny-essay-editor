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
import { decodeChange, getAllChanges } from "@automerge/automerge/next";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [session, setSessionInMemory] = useState<LocalSession>();
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadId, setActiveThreadId] = useState<string | null>();
  const [view, setView] = useState<EditorView>();
  const [diffHeads, setDiffHeads] = useState<string[]>([]);

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

  // useEffect(() => {
  //   if (!doc) return;
  //   setDiffHeads([decodeChange(getAllChanges(doc)[1]).hash]);
  // }, [doc]);

  if (!doc || !session) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  const changes = getAllChanges(handle.docSync());

  return (
    <div className="flex flex-row h-screen">
      <div className="flex-grow overflow-y-scroll">
        <div className="sticky z-50 top-0 w-full">
          <Navbar
            handle={handle}
            doc={doc}
            changeDoc={changeDoc}
            session={session}
            setSession={setSession}
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
              diffHeads={diffHeads}
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
      <div className="w-72 bg-gray-100">
        <div className="p-4 text-gray-500 uppercase font-medium text-sm">
          Version Control
        </div>
        <div className="p-2 border-t border-b border-gray-300">
          <div className="text-xs">Diff against older draft</div>
          <input
            type="range"
            min="0"
            max={changes.length - 1}
            onChange={(e) => {
              const change = changes[e.target.value];
              setDiffHeads([decodeChange(change).hash]);
            }}
            value={changes.findIndex(
              (change) => decodeChange(change).hash === diffHeads[0]
            )}
          />
        </div>
        <div className="p-2 border-b border-gray-300">
          <div className="text-xs">Changelog</div>
          {getAllChanges(doc)
            .reverse()
            .map((change, i) => {
              const decoded = decodeChange(change);
              const active = decoded.hash === diffHeads[0];
              return (
                <div
                  className={`text-xs cursor-default mb-1 ${
                    active ? "font-bold" : ""
                  }`}
                  onMouseEnter={() => setDiffHeads([decoded.hash])}
                >
                  {decoded.hash}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default App;
