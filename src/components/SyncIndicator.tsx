import { arraysEqual } from "@/lib/utils"
import * as A from "@automerge/automerge"
import { DocHandle } from "@automerge/automerge-repo"
import { useDocument } from "@automerge/automerge-repo-react-hooks"
import { useState, useEffect } from "react"
import {
  Circle,
  CircleDashed
} from "lucide-react";


const SYNC_SERVER_PEER_ID = "storage-server-sync-automerge-org"

export const SyncIndicator = ({
  handle
}: {
  handle: DocHandle<unknown>
}) => {
  const remoteHeads = useRemoteHeads(handle)
  const syncServerHeads = remoteHeads[SYNC_SERVER_PEER_ID]?.heads ?? []
  const currentHeads = handle.docSync() ? A.getHeads(handle.docSync()) : []

  const isSynced = arraysEqual(currentHeads, syncServerHeads)

  return isSynced ? <Circle size={"14px"} /> : <CircleDashed size={"14px"} className="" />
}

function useRemoteHeads(handle) {
  const [headsMap, setHeadsMap] = useState({})

  useEffect(() => {
    handle.on("remote-heads", (data) => {
      setHeadsMap((headsMap) => ({
        ...headsMap,
        [data.remote]: { heads: data.heads, received: data.received }
      }))
    })
  }, [handle])


  return headsMap
}
