import React from "react"
import { AutomergeUrl } from "@automerge/automerge-repo"
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks"
import { RichTextEditor } from "./RichTextEditor"

type TeeDoc = {
  content: string
}

export const RichTeeEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc] = useDocument<TeeDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TeeDoc>(docUrl);

  if (!doc) {
    return null
  }

  return (
    <div className="h-full overflow-auto">
      <RichTextEditor
        handle={handle}
        path={["content"]}
      />
    </div>
  );
}
