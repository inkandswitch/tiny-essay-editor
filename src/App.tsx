import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { next as A } from "@automerge/automerge";
import MarkdownEditor from "./MarkdownEditor";
import { css } from "@emotion/react";

export interface TextDoc {
  content: string;
}

function App({ docUrl }: { docUrl: AutomergeUrl }) {
  const [doc, changeDoc] = useDocument<TextDoc>(docUrl);

  if (!doc) return <></>;

  return (
    <div
      css={css`
        width: 100vw;
        height: 100vh;
      `}
    >
      <MarkdownEditor doc={doc} changeDoc={changeDoc} />
    </div>
  );
}

export default App;
