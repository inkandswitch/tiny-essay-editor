import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import { MarkdownDoc } from "../schema";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);

  if (!doc) {
    return `Loading ${docUrl}: ${handle.state}...`;
  }

  return (
    <div>
      <div className="h-10 w-screen bg-gray-200 p-2 bg-gradient-to-b from-white to-gray-200 border-b border-gray-300 align-middle">
        <img
          className="h-full inline-block mr-1"
          src="/assets/logo-favicon-310x310-transparent.png"
        />
        <div className="inline-block align-middle">Tiny Essay Editor</div>
      </div>
      <div className="flex bg-gray-50">
        <div className="w-4/5 max-w-[776px] bg-white my-4 mx-8 border border-gray-200 p-4 ">
          <MarkdownEditor handle={handle} path={["content"]} />
        </div>
        <div className="flex-grow bg-gray-50 p-4">
          <Button className="" variant="outline">
            Add a comment
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;
