import { useMemo } from "react";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";

import { TLDrawDoc } from "../schema";
import { useAutomergeStore } from "../vendor/automerge-tldraw";
import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useCurrentAccount } from "@/DocExplorer/account";
import { next as A } from "@automerge/automerge";

export const TLDraw = ({
  docUrl,
  heads,
}: {
  docUrl: AutomergeUrl;
  heads?: A.Heads;
}) => {
  useDocument<TLDrawDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<TLDrawDoc>(docUrl);
  const account = useCurrentAccount();
  const userId = account ? account.contactHandle.url : "no-account";

  const [doc] = useDocument<TLDrawDoc>(docUrl);
  const docAtHeads = useMemo(
    () => (heads ? A.view(doc, heads) : undefined),
    [doc, heads]
  );

  const store = useAutomergeStore({ handle, userId });
  return (
    <div className="tldraw__editor h-full overflow-auto">
      {heads ? (
        docAtHeads ? (
          <ReadOnlyTLDraw
            key={JSON.stringify(heads)}
            userId={userId}
            doc={docAtHeads}
            handle={handle}
          />
        ) : null
      ) : (
        <Tldraw autoFocus store={store} />
      )}
    </div>
  );
};

const ReadOnlyTLDraw = ({
  doc,
  handle,
  userId,
}: {
  doc: TLDrawDoc;
  handle: DocHandle<TLDrawDoc>;
  userId: string;
}) => {
  const store = useAutomergeStore({ handle, doc, userId });

  return (
    <Tldraw
      store={store}
      autoFocus
      onMount={(editor) => {
        editor.updateInstanceState({ isReadonly: true });
      }}
    />
  );
};
