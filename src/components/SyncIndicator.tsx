import { next as A } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { useState, useEffect } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { WifiIcon, WifiOffIcon } from "lucide-react";
import { arraysAreEqual } from "@/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getRelativeTimeString } from "@/utils";

// if we are connected to the sync server and have outstanding changes we should switch to the error mode if we haven't received a sync message in a while
// this variable specifies this timeout duration
const SYNC_TIMEOUT = 3000;

// wait initially if we haven't connnected to the sync server yet
const INITIAL_CONNECTION_WAIT = 2000;

export const SyncIndicator = ({ handle }: { handle: DocHandle<unknown> }) => {
  const { isSynced, lastSyncUpdate } = useSyncStateOfServer(handle);
  const isOnline = useIsOnline();
  const isConnectedToServer = useIsConnectedToServer();
  const hasSyncTimedOut = useHasTimedOut({
    duration: SYNC_TIMEOUT,
    timestamp: lastSyncUpdate,
    isActive: !isSynced,
  });
  const hasInitialConnectionWaitTimedOut = useHasTimedOut({
    duration: INITIAL_CONNECTION_WAIT,
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  if (isOnline) {
    if (
      (isConnectedToServer || !hasInitialConnectionWaitTimedOut) &&
      (isSynced || !hasSyncTimedOut)
    ) {
      return (
        <Popover open={isHovered} onOpenChange={setIsHovered}>
          <PopoverTrigger
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="outline-none focus:outline-none cursor-default"
          >
            <div className="text-gray-500">
              <WifiIcon size={"20px"} className="inline-block mr-[7px]" />
            </div>
          </PopoverTrigger>
          <PopoverContent
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <dl className="text-sm text-gray-600">
              <div>
                <dt className="font-bold inline mr-1">Connection:</dt>
                <dd className="inline">Connected to server</dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Last synced:</dt>
                <dd className="inline">
                  {getRelativeTimeString(lastSyncUpdate)}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Sync status:</dt>
                <dd className="inline">
                  {isSynced ? "Up to date" : "Unsynced changes"}
                </dd>
              </div>
            </dl>
          </PopoverContent>
        </Popover>
      );
    } else {
      return (
        <Popover open={isHovered} onOpenChange={setIsHovered}>
          <PopoverTrigger
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="outline-none focus:outline-none cursor-default"
          >
            <div className="text-red-500 flex items-center text-sm">
              <WifiIcon
                size={"20px"}
                className={`inline-block ${isSynced ? "mr-[7px]" : ""}`}
              />
              {!isSynced && <div className="inline text-xs">*</div>}
              <div className="ml-1">Sync Error</div>
            </div>
          </PopoverTrigger>
          <PopoverContent
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="mb-2 text-sm">
              There was an unexpected error connecting to the sync server.
            </div>
            <dl className="text-sm text-gray-600">
              <div>
                <dt className="font-bold inline mr-1">Connection:</dt>
                <dd className="inline text-red-500">Connection error</dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Last synced:</dt>
                <dd className="inline">
                  {getRelativeTimeString(lastSyncUpdate)}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Sync status:</dt>
                <dd className="inline">
                  {isSynced ? "Up to date" : "Unsynced changes"}
                </dd>
              </div>
            </dl>
          </PopoverContent>
        </Popover>
      );
    }
  } else {
    return (
      <Popover open={isHovered} onOpenChange={setIsHovered}>
        <PopoverTrigger
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="outline-none focus:outline-none cursor-default"
        >
          <div className="text-gray-500">
            <WifiOffIcon
              size={"20px"}
              className={`inline-block ${isSynced ? "mr-[7px]" : ""}`}
            />
            {!isSynced && <div className="inline text-xs">*</div>}
          </div>
        </PopoverTrigger>
        <PopoverContent
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <dl className="text-sm text-gray-600">
            <div>
              <dt className="font-bold inline mr-1">Connection:</dt>
              <dd className="inline">Offline</dd>
            </div>
            <div>
              <dt className="font-bold inline mr-1">Last synced:</dt>
              <dd className="inline">
                {getRelativeTimeString(lastSyncUpdate)}
              </dd>
            </div>
            <div>
              <dt className="font-bold inline mr-1">Sync status:</dt>
              <dd className="inline text-red-500">
                {isSynced ? "No unsynced changes" : "Unsynced changes"}
              </dd>
            </div>
          </dl>
        </PopoverContent>
      </Popover>
    );
  }
};

const SYNC_SERVER_PREFIX = "storage-server-";

interface TimeoutConfig {
  duration: number;
  timestamp?: number;
  isActive?: boolean; // set a condition, when it's false the timeout becomes never true
}

function useHasTimedOut({
  duration,
  timestamp,
  isActive = true,
}: TimeoutConfig) : boolean {
  const [hasTimedOut, setHasTimedOut] = useState(
    getHasTimedOut(timestamp, duration)
  );

  useEffect(() => {
    if (!isActive) {
      setHasTimedOut(false);
      return;
    }

    if (timestamp === undefined) {
      timestamp = Date.now();
    }

    if (getHasTimedOut(timestamp, duration)) {
      setHasTimedOut(true);
      return;
    }

    setHasTimedOut(false);

    const timeoutCallback = () => {
      setHasTimedOut(true);
    };

    const timeout = setTimeout(
      timeoutCallback,
      duration - (Date.now() - timestamp)
    );

    return () => {
      setHasTimedOut(getHasTimedOut(timestamp, duration));
      clearTimeout(timeout);
    };
  }, [isActive, timestamp, duration]);


  if (!isActive) {
    return false
  }

  return hasTimedOut;
}

function getHasTimedOut(timestamp: number, timeoutDuration: number): boolean {
  return Date.now() - timestamp >= timeoutDuration;
}

interface SyncState {
  isSynced: boolean;
  lastSyncUpdate: number;
}

function useSyncStateOfServer(handle: DocHandle<unknown>): SyncState {
  const [currentHeads, setCurrentHeads] = useState(
    A.getHeads(handle.docSync())
  );
  const [syncedHeads, setSyncedHeads] = useState([]);
  const [lastSyncUpdate, setLastSyncUpdate] = useState(Date.now()); // initialize to now, so we don't go into an error state before first sync

  useEffect(() => {
    handle.on("change", () => {
      setCurrentHeads(A.getHeads(handle.docSync()));
    });

    handle.on("remote-heads", ({ peerId, heads }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        // todo: should add date to sync state
        setLastSyncUpdate(Date.now());
        setSyncedHeads(heads);
      }
    });
  }, [handle]);

  return {
    isSynced: arraysAreEqual(currentHeads, syncedHeads),
    lastSyncUpdate,
  };
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
