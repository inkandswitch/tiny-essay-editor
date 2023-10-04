import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import { LocalSession, MarkdownDoc } from "../schema";
import { Navbar } from "./Navbar";
import { LoadingScreen } from "./LoadingScreen";
import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [session, setSessionInMemory] = useState<LocalSession>();
  const [selection, setSelection] = useState<TextSelection>();

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

  if (!doc || !session) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

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
          />
        </div>
        <div className="flex-grow bg-gray-50 p-4">
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
              <Button variant="outline">Comment</Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export default App;
