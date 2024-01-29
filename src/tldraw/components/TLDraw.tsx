import { AutomergeUrl } from "@automerge/automerge-repo"
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks"

import { TLDrawDoc } from "../schema"
import { useAutomergeStore } from "automerge-tldraw"
import { Tldraw } from "@tldraw/tldraw"
import "@tldraw/tldraw/tldraw.css"

export const TLDraw = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  useDocument<TLDrawDoc>(docUrl) // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl)

  const userId = "someone"
  const store = useAutomergeStore({ handle, userId })
  return (
    <div className="tldraw__editor h-full overflow-auto">
      <Tldraw autoFocus store={store} />
    </div>
  )
}
