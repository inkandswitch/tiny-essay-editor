import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import MarkdownEditor from "./MarkdownEditor";
import { css } from "@emotion/react";
import { MarkdownDoc } from "./schema";

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  if (!doc) return <></>;

  return (
    <div
      css={css`
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      `}
    >
      <MarkdownEditor doc={doc} changeDoc={changeDoc} />
    </div>
  );
}

export default App;
