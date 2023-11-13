import * as A from "@automerge/automerge"
import { DocHandle, PeerId } from "@automerge/automerge-repo"
import { useState, useEffect } from "react"
import {
  Circle,
  CircleDashed
} from "lucide-react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { red, green, gray } from "tailwindcss/colors"

export const SyncIndicator = ({
  handle
}: {
  handle: DocHandle<unknown>
}) => {
  // todo: sync shouldn't flicker. It should be based on if we are making progress syncing the changes.
  // While a user is actively editing the document their heads will never match the synced heads
  // is is fine and shouldn't be counted as out of sync as long as they are not lagging behind the sync server by too much
  const isSynced = useIsSyncedWithServer(handle)
  const isOnline = useIsOnline()
  const isConnectedToServer = useIsConnectedToServer()
  const hasError = isOnline && !isConnectedToServer

  let color : string
  if (hasError) {
    color = red[500]
  } else if (isOnline) {
    color = green[500]
  } else {
    color = gray[500]
  }

  return (
    !isSynced
      ? <CircleDashed size={"20px"} color={color} />
      : <Circle size={"20px"} color={color} /> 
  )
}

const SYNC_SERVER_PREFIX = "storage-server-"

function useIsSyncedWithServer (handle: DocHandle<unknown>) : boolean {
  const [currentHeads, setCurrentHeads] = useState(A.getHeads(handle.docSync()))
  const [syncServerPeerId, setSyncServerPeerId] = useState<PeerId | null>(null)
  const [syncedHeads, setSyncedHeads] =  useState(handle.getRemoteHeads(syncServerPeerId) ?? [])

  useEffect(() => {
    handle.on("change", () => {
      setCurrentHeads(A.getHeads(handle.docSync()))
    })

    handle.on("remote-heads", ({ peerId, heads }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        setSyncedHeads(heads)
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

function useIsConnectedToServer () {
  const repo = useRepo()
  const [isConnected, setIsConnected] = useState(() => repo.peers.some( p => p.match(SYNC_SERVER_PREFIX) ))

  useEffect(() => {
    const onPeerConnected = ({peerId}) => {
      console.log("connected", peerId)

      if (peerId.match(SYNC_SERVER_PREFIX)) {
        setIsConnected(true)
      }
    }

    const onPeerDisconnnected = ({peerId}) => {
      console.log("disconnect", peerId)

      if (peerId.match(SYNC_SERVER_PREFIX)) {
        setIsConnected(false)
      }
    }

    repo.networkSubsystem.on("peer", onPeerConnected)
    repo.networkSubsystem.on("peer-disconnected", onPeerDisconnnected)
  }, [repo])

  return isConnected
}

function useIsOnline () {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => {
      console.log("online")
      setIsOnline(true)
    }

    const onOffline = () => {
      console.log("offline")
      setIsOnline(false)
    }
    
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)    
    }
  }, [])

  return isOnline
}