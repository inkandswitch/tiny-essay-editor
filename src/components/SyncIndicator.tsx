import { next as A } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { useState, useEffect } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { WifiIcon, WifiOffIcon } from "lucide-react";

// if we are connected to the sync server and have outstanding changes we should switch to the error mode if we haven't received a sync message in a while
// this variable specifies this timeout duration
const SYNC_TIMEOUT = 3000 

export const SyncIndicator = ({ handle }: { handle: DocHandle<unknown> }) => {
  // todo: sync shouldn't flicker. It should be based on if we are making progress syncing the changes.
  // While a user is actively editing the document their heads will never match the synced heads
  // is is fine and shouldn't be counted as out of sync as long as they are not lagging behind the sync server by too much
  const {isSynced, lastSyncUpdate} = useSyncStateOfServer(handle);
  const isOnline = useIsOnline();
  const isConnectedToServer = useIsConnectedToServer();
  const isTimedOut = useIsTimedOut(lastSyncUpdate, SYNC_TIMEOUT)

  if (isOnline) {
    if (isConnectedToServer && (isSynced || !isTimedOut)) {
      return (
        <div className="text-gray-500">
          <WifiIcon size={"20px"} className="inline-block mr-[7px]" />
        </div>
      );
    } else {
      return (
        <div className="text-red-500 flex items-center">
          <WifiIcon size={"20px"} className={`inline-block ${isSynced ? "mr-[7px]" : ""}`} />
          {!isSynced && <div className="inline text-xs">*</div>}
          <div className="ml-1">Sync Error</div>
        </div>
      );
    }
  } else {
    return (
      <div className="text-gray-500">
        <WifiOffIcon size={"20px"} className={`inline-block ${isSynced ? "mr-[7px]" : ""}`} />
        {!isSynced && <div className="inline text-xs">*</div>}
      </div>
    );
  }
};


const SYNC_SERVER_PREFIX = "storage-server-";

function useIsTimedOut (timestamp: number, duration: number) {
  const [isTimedOut, setIsTimedOut] = useState(getIsTimedOut(timestamp, duration))

  useEffect(() => {
    console.log(timestamp, duration, getIsTimedOut(timestamp, duration))

    if (getIsTimedOut(timestamp, duration)) {
      setIsTimedOut(true)
      return
    } 

    setIsTimedOut(false)

    const timeoutCallback = () => {  
      setIsTimedOut(true)
    }

    const timeout = setTimeout(timeoutCallback, duration - (Date.now() - timestamp))

    return () => {
      setIsTimedOut(getIsTimedOut(timestamp, duration))
      clearTimeout(timeout)
    }
  }, [timestamp, duration])


  return isTimedOut
}

function getIsTimedOut (timestamp: number, timeoutDuration: number) : boolean {
  return (Date.now() - timestamp) >= timeoutDuration
}

interface SyncState {
  isSynced: boolean,
  lastSyncUpdate: number
}

function useSyncStateOfServer(handle: DocHandle<unknown>): SyncState {
  const [currentHeads, setCurrentHeads] = useState(
    A.getHeads(handle.docSync())
  );
  const [syncedHeads, setSyncedHeads] = useState([]);
  const [lastSyncUpdate, setLastSyncUpdate] = useState(Date.now()) // initialize to now, so we don't go into an error state before first sync

  useEffect(() => {
    handle.on("change", () => {
      setCurrentHeads(A.getHeads(handle.docSync()));
    });

    handle.on("remote-heads", ({ peerId, heads }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        // todo: should add date to sync state
        setLastSyncUpdate(Date.now()) 
        setSyncedHeads(heads);
      }
    });
  }, [handle]);


  return {
    isSynced : arraysEqual(currentHeads, syncedHeads),
    lastSyncUpdate
  }
}

export function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function useIsConnectedToServer() {
  const repo = useRepo();
  const [isConnected, setIsConnected] = useState(() =>
    repo.peers.some((p) => p.match(SYNC_SERVER_PREFIX))
  );

  useEffect(() => {
    const onPeerConnected = ({ peerId }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        setIsConnected(true);
      }
    };

    const onPeerDisconnnected = ({ peerId }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        setIsConnected(false);
      }
    };

    repo.networkSubsystem.on("peer", onPeerConnected);
    repo.networkSubsystem.on("peer-disconnected", onPeerDisconnnected);
  }, [repo]);

  return isConnected;
}

function useIsOnline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
}
