import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import '@tldraw/tldraw/tldraw.css'

import "../../tee/index.css";
import { useAutomergeStore } from "../automerge-tlstore/useAutomergeStore";
import { Tldraw } from "@tldraw/tldraw";
import { DEFAULT_STORE } from "../automerge-tlstore/default_store";
import { useCurrentAccount } from "@/DocExplorer/account";

export const TinyEssayEditor = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  const [doc, changeDoc] = useDocument<any>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<any>(docUrl);
  const account = useCurrentAccount()
  console.log(account)

  if (doc && Object.keys(doc).length === 0) {
    changeDoc(d => Object.assign(d, DEFAULT_STORE.store) )
  }
  const userId = "someone"
  const store = useAutomergeStore({ handle, userId })

  return (
    <div className="tldraw__editor h-full overflow-auto">
      <Tldraw autoFocus store={store}/>
    </div>
  )
};
