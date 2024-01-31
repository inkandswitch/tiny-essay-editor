import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "automerge-tldraw";
import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";
import { useAutomergePresence } from "automerge-tldraw";

export const TLDraw = ({ docUrl }: { docUrl: AutomergeUrl }) => {
  useDocument<TLDrawDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  let userMetadata
  if (account && account.contactHandle && account.contactHandle.docSync()) {
    const userDoc = account.contactHandle.docSync();

    userMetadata = {
      userId: account.contactHandle.url,
      color: userDoc.color || "red",
      name: userDoc.name || "Anonymous",
    }
  } else {
    userMetadata = {
      userId: "no-account",
      color: "blue",
      name: "Anonymous Coward",
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
