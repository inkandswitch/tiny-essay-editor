import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { useAutomergeStore, useAutomergePresence } from "automerge-tldraw";
import { TLStoreSnapshot, Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";

export const TLDraw = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  useDocument<TLStoreSnapshot>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLStoreSnapshot>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  /* I don't love any of this! I feel like the API is all wrong here
     for me to be dealing with this kind of stuff */
  const userMetadata = {
    userId: "no-account",
    color: "blue",
    name: "Anonymous",
  }

  if (account && account.contactHandle) {
    userMetadata.userId = account.contactHandle.url;
  }

  if (account && account.contactHandle && account.contactHandle.docSync()) {
    const userDoc = account.contactHandle.docSync();
    if (userDoc.type == "registered") {
      userMetadata.color = userDoc.color || "blue";
      userMetadata.name = userDoc.name || "Unnamed User";
    }
  }

  const store = useAutomergeStore({ handle, userId });
  useAutomergePresence({ store, handle, userMetadata });
  return (
    <div className="tldraw__editor h-full overflow-auto">
      <Tldraw autoFocus store={store} />
    </div>
  );
};
