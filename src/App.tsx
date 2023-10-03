import { AutomergeUrl } from "@automerge/automerge-repo";
import { useHandle } from "@automerge/automerge-repo-react-hooks";
import { Editor } from "./MarkdownEditor";
import { css } from "@emotion/react";
import { MarkdownDoc } from "./schema";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const handle = useHandle<MarkdownDoc>(docUrl);

  return (
    <div
      css={css`
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      `}
    >
      <Editor handle={handle} path={["content"]} />
    </div>
  );
}

export default App;
