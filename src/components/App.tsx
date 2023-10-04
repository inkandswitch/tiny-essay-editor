import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownDoc } from "../schema";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);

  if (!doc) {
    return `Loading ${docUrl}: ${handle.state}...`;
  }

  return (
    <div>
      <div className="h-10 w-screen bg-gray-200 p-2 bg-gradient-to-b from-white to-gray-200 border-b border-gray-300">
        Tiny Essay Editor
      </div>
      <div className="flex gap-8">
        <div className="w-4/5 max-w-[776px]">
          <MarkdownEditor handle={handle} path={["content"]} />
        </div>
        <div className="flex-grow">Comments</div>
      </div>
    </div>
  );
}

export default App;
