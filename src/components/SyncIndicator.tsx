import * as A from "@automerge/automerge"
import { DocHandle, PeerId } from "@automerge/automerge-repo"
import { useState, useEffect } from "react"
import {
  Circle,
  CircleDashed
} from "lucide-react";


export const SyncIndicator = ({
  handle
}: {
  handle: DocHandle<unknown>
}) => {
  const isSynced = useIsSyncedWithServer(handle)

  return isSynced ? <Circle size={"14px"} /> : <CircleDashed size={"14px"} className="" />
}

const SYNC_SERVER_PEER_ID = "storage-server-sync-automerge-org" as PeerId

function useIsSyncedWithServer (handle: DocHandle<unknown>) : boolean {
  const [currentHeads, setCurrentHeads] = useState(A.getHeads(handle.docSync()))
  const [syncedHeads, setSyncedHeads] = useState(handle.getSyncState(SYNC_SERVER_PEER_ID)?.sharedHeads ?? [])

  useEffect(() => {
    handle.on("change", (doc) => {
      setCurrentHeads(A.getHeads(handle.docSync()))
    })

    handle.on("sync-state", ({ peerId, syncState }) => {
      if (peerId === SYNC_SERVER_PEER_ID) {
        setSyncedHeads(syncState.sharedHeads)
      }
    })
  }, [handle])


  return arraysEqual(currentHeads, syncedHeads)
}

export function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
