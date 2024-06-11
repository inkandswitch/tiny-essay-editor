import {
  TLAnyShapeUtilConstructor,
  TLRecord,
  TLStoreWithStatus,
  createTLStore,
  defaultShapeUtils,
  HistoryEntry,
  getUserPreferences,
  setUserPreferences,
  defaultUserPreferences,
  createPresenceStateDerivation,
  InstancePresenceRecordType,
  computed,
  react,
  TLStoreSnapshot,
  sortById,
} from "@tldraw/tldraw";
import { useEffect, useState } from "react";
import { DocHandle, DocHandleChangePayload } from "@automerge/automerge-repo";
import {
  useLocalAwareness,
  useRemoteAwareness,
} from "@automerge/automerge-repo-react-hooks";

import { applyAutomergePatchesToTLStore } from "./AutomergeToTLStore";
import { applyTLStoreChangesToAutomerge } from "./TLStoreToAutomerge";
import { TLDrawDoc } from "../../datatype";

export function useAutomergeStore({
  handle,
  doc,
  shapeUtils = [],
}: {
  handle: DocHandle<TLStoreSnapshot>;
  doc?: TLDrawDoc; // if doc is passed in handle is ignored
  userId: string;
  shapeUtils?: TLAnyShapeUtilConstructor[];
}): TLStoreWithStatus {
  const [store] = useState(() => {
    const store = createTLStore({
      shapeUtils: [...defaultShapeUtils, ...shapeUtils],
    });
    return store;
  });

  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  /* -------------------- TLDraw <--> Automerge -------------------- */
  useEffect(() => {
    if (!handle) return;
    const unsubs: (() => void)[] = [];

    // A hacky workaround to prevent local changes from being applied twice
    // once into the automerge doc and then back again.
    let preventPatchApplications = false;

    /* TLDraw to Automerge */
    function syncStoreChangesToAutomergeDoc({
      changes,
    }: HistoryEntry<TLRecord>) {
      preventPatchApplications = true;
      handle.change((doc) => {
        applyTLStoreChangesToAutomerge(doc, changes);
      });
      preventPatchApplications = false;
    }

    unsubs.push(
      store.listen(syncStoreChangesToAutomergeDoc, {
        source: "user",
        scope: "document",
      })
    );

    /* Automerge to TLDraw */
    const syncAutomergeDocChangesToStore = ({
      patches,
    }: DocHandleChangePayload<any>) => {
      if (preventPatchApplications) return;

      applyAutomergePatchesToTLStore(patches, store);
    };

    handle.on("change", syncAutomergeDocChangesToStore);
    unsubs.push(() => handle.off("change", syncAutomergeDocChangesToStore));

    /* Defer rendering until the document is ready */
    // TODO: need to think through the various status possibilities here and how they map

    // hack skip loading from handle if doc is passed directly
    // for this tldraw should be in readonly mode otherwise this will break
    Promise.resolve(
      doc ?? handle.whenReady().then(() => handle.docSync())
    ).then((doc) => {
      if (!doc) throw new Error("Document not found");
      if (!doc.store) throw new Error("Document store not initialized");

      store.mergeRemoteChanges(() => {
        store.loadSnapshot({
          store: JSON.parse(JSON.stringify(doc.store)),
          schema: doc.schema,
        });
      });

      setStoreWithStatus({
        store,
        status: "synced-remote",
        connectionStatus: "online",
      });
    });

    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
    };
  }, [doc, handle, store]);

  return storeWithStatus;
}

export function useAutomergePresence({
  handle,
  store,
  userMetadata,
}: {
  handle: DocHandle<TLStoreSnapshot>;
  store: TLStoreWithStatus;
  userMetadata: any;
}) {
  const innerStore = store?.store;

  const { userId, name, color } = userMetadata;

  const [, updateLocalState] = useLocalAwareness({
    handle,
    userId,
    initialState: {},
  });

  const [peerStates] = useRemoteAwareness({
    handle,
    localUserId: userId,
  });

  /* ----------- Presence stuff ----------- */
  useEffect(() => {
    if (!innerStore) return;

    const toPut: TLRecord[] = Object.values(peerStates).filter(
      (record) => record && Object.keys(record).length !== 0
    );

    // put / remove the records in the store
    const toRemove = innerStore.query
      .records("instance_presence")
      // @ts-expect-error tldraw types need update
      .get()
      .sort(sortById)
      .map((record) => record.id)
      .filter((id) => !toPut.find((record) => record.id === id));

    if (toRemove.length) innerStore.remove(toRemove);
    if (toPut.length) innerStore.put(toPut);
  }, [innerStore, peerStates]);

  useEffect(() => {
    if (!innerStore) return;
    /* ----------- Presence stuff ----------- */
    setUserPreferences({ id: userId, color, name });

    const userPreferences = computed<{
      id: string;
      color: string;
      name: string;
    }>("userPreferences", () => {
      const user = getUserPreferences();
      return {
        id: user.id,
        color: user.color ?? defaultUserPreferences.color,
        name: user.name ?? defaultUserPreferences.name,
      };
    });

    const presenceId = InstancePresenceRecordType.createId(userId);
    const presenceDerivation = createPresenceStateDerivation(
      userPreferences,
      presenceId
    )(innerStore);

    return react("when presence changes", () => {
      // @ts-expect-error tldraw types need update
      const presence = presenceDerivation.get();
      requestAnimationFrame(() => {
        updateLocalState(presence);
      });
    });
  }, [innerStore, userId, updateLocalState, color, name]);
  /* ----------- End presence stuff ----------- */
}
