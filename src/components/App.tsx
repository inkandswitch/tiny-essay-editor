import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import {
  Comment,
  CommentThread,
  CommentThreadWithResolvedPositions,
  LocalSession,
  MarkdownDoc,
} from "../schema";
import { Navbar } from "./Navbar";
import { LoadingScreen } from "./LoadingScreen";
import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, uuid } from "@automerge/automerge";
import { mapValues } from "lodash";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EditorView } from "codemirror";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [session, setSessionInMemory] = useState<LocalSession>();
  const [selection, setSelection] = useState<TextSelection>();
  const [view, setView] = useState<EditorView>();

  const showCommentButton = selection && selection.from !== selection.to;

  useEffect(() => {
    const session = localStorage.getItem("LocalSession");
    if (session) {
      setSessionInMemory(JSON.parse(session));
    } else {
      setSessionInMemory({ userId: null });
    }
  }, []);

  const setSession = (session: LocalSession) => {
    localStorage.setItem("LocalSession", JSON.stringify(session));
    setSessionInMemory(session);
  };

  const threadsWithPositions: {
    [key: string]: CommentThreadWithResolvedPositions;
  } = mapValues(doc?.commentThreads ?? {}, (thread) => {
    const from = A.getCursorPosition(
      handle.docSync(),
      ["content"],
      thread.fromCursor
    );
    const to = A.getCursorPosition(
      handle.docSync(),
      ["content"],
      thread.toCursor
    );
    const topOfEditor = view?.scrollDOM.getBoundingClientRect().top ?? 0;
    const viewportCoordsOfThread = view?.coordsAtPos(from).top ?? 0;
    const yCoord = -1 * topOfEditor + viewportCoordsOfThread + 80; // why 100??

    console.log({ from, to, topOfEditor, viewportCoordsOfThread, yCoord });

    return {
      ...thread,
      from,
      to,
      yCoord,
    };
  });

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const fromCursor = A.getCursor(
      handle.docSync(),
      ["content"],
      selection.from
    );
    const toCursor = A.getCursor(handle.docSync(), ["content"], selection.to);

    const comment: Comment = {
      id: uuid(),
      content: commentText,
      userId: session?.userId ?? null,
      timestamp: Date.now(),
    };

    const thread: CommentThread = {
      id: uuid(),
      comments: [comment],
      resolved: false,
      fromCursor,
      toCursor,
    };

    changeDoc((doc) => {
      doc.commentThreads[thread.id] = thread;
    });
  };

  if (!doc || !session) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  console.log("in app", { view });

  return (
    <div>
      <Navbar
        doc={doc}
        changeDoc={changeDoc}
        session={session}
        setSession={setSession}
      />
      <div className="flex bg-gray-50">
        <div className="w-4/5 max-w-[776px] bg-white my-4 ml-8 mr-4 border border-gray-200 p-4 ">
          <MarkdownEditor
            handle={handle}
            path={["content"]}
            setSelection={setSelection}
            setView={(view) => setView(view as EditorView)}
          />
        </div>
        <div className="flex-grow bg-gray-50 p-4">
          {Object.values(threadsWithPositions).map((thread) => (
            <div
              key={thread.id}
              className="bg-white p-4 absolute"
              style={{ top: thread.yCoord }}
            >
              {thread.comments.map((comment) => (
                <div>
                  <div className="mb-2">{comment.content}</div>
                  <div className="text-sm text-gray-600">
                    {doc.users.find((user) => user.id === comment.userId)
                      .name ?? "unknown"}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className={`transition fixed duration-200 ease-in-out ${
                  showCommentButton ? "opacity-100" : "opacity-0"
                }`}
                variant="outline"
                style={{
                  top: (selection?.yCoord ?? 0) - 11,
                }}
              >
                <MessageSquarePlus size={24} className="mr-2" />
                Add a comment
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Textarea className="mb-4" />
              <Button
                variant="outline"
                onClick={() => startCommentThreadAtSelection("hello")}
              >
                Comment
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export default App;
