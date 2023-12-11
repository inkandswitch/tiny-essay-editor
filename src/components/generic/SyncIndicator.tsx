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
import { useRef } from "react";

// if we are connected to the sync server and have outstanding changes we should switch to the error mode if we haven't received a sync message in a while
// this variable specifies this timeout duration
const SYNC_TIMEOUT = 3000;

// wait initially if we haven't connnected to the sync server yet
const INITIAL_CONNECTION_WAIT = 3000;

export const SyncIndicator = ({ handle }: { handle: DocHandle<unknown> }) => {
  const { isSynced, lastSyncUpdate, syncTimeoutTimestamp } =
    useSyncStateOfServer(handle);
  const onlineState = useIsOnline();
  const isConnectedToServer = useIsConnectedToServer();
  const hasSyncTimedOut = useHasTimedOut({
    duration: SYNC_TIMEOUT,
    // when we come back online we want to timeout starting from the time we're back online and not the time we last synced
    timestamp: Math.max(syncTimeoutTimestamp, onlineState.timestamp),
    isActive: !isSynced,
  });
  const hasInitialConnectionWaitTimedOut = useHasTimedOut({
    duration: INITIAL_CONNECTION_WAIT,
    timestamp: onlineState.timestamp,
    isActive: onlineState.isOnline,
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  if (onlineState.isOnline) {
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
                  {isSynced ? "Up to date" : "Syncing..."}
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
              There was an unexpected error connecting to the sync server. Don't
              worry, your changes are saved locally. Please try reloading and
              see if that fixes the issue.
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
                  {isSynced ? (
                    "No unsynced changes"
                  ) : (
                    <span className="text-red-500">Unsynced changes (*)</span>
                  )}
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
            {!isSynced && (
              <div className="inline text-xs font-bold text-red-600">*</div>
            )}
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
              <dd className="inline">
                {isSynced ? (
                  "No unsynced changes"
                ) : (
                  <span className="text-red-500">
                    You have unsynced changes. They are saved locally and will
                    sync next time you have internet and you open the app.
                  </span>
                )}
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
}: TimeoutConfig): boolean {
  const [hasTimedOut, setHasTimedOut] = useState(
    isActive && getHasTimedOut(timestamp, duration)
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
    return false;
  }

  return hasTimedOut;
}

function getHasTimedOut(timestamp: number, timeoutDuration: number): boolean {
  return Date.now() - timestamp >= timeoutDuration;
}

interface SyncState {
  isSynced: boolean;
  lastSyncUpdate: number; // when was the last time we received a sync from the server

  // timestamp from which we should start a sync timeout
  // - gets updated on each sync message
  // - when we start to switch from previously synced to unsynced we also reset it
  syncTimeoutTimestamp: number;
}

function useSyncStateOfServer(handle: DocHandle<unknown>): SyncState {
  const [currentHeads, setCurrentHeads] = useState(
    A.getHeads(handle.docSync())
  );
  const [syncedHeads, setSyncedHeads] = useState([]);
  // initialize lastSyncUpdate and syncTimeoutTimestamp to now, so we don't go into an error state before first sync
  const [lastSyncUpdate, setLastSyncUpdate] = useState(Date.now());
  const [syncTimeoutTimestamp, setSyncTimeoutTimestamp] = useState(Date.now());
  const isSynced = arraysAreEqual(currentHeads, syncedHeads);
  const isSyncedRef = useRef(isSynced);
  isSyncedRef.current = isSynced;

  useEffect(() => {
    handle.on("change", () => {
      const wasInSync = isSyncedRef.current;
      const newHeads = A.getHeads(handle.docSync());

      setCurrentHeads(newHeads);

      // need to access isSynced through ref because otherwise we constantly need to reregister the event handlers
      if (wasInSync) {
        setSyncTimeoutTimestamp(Date.now());
      }
    });

    handle.on("remote-heads", ({ peerId, heads }) => {
      if (peerId.match(SYNC_SERVER_PREFIX)) {
        // todo: should add date to sync state

        const now = Date.now();
        setLastSyncUpdate(now);
        setSyncTimeoutTimestamp(now);
        setSyncedHeads(heads);
      }
    });
  }, [handle]);

  return {
    isSynced,
    lastSyncUpdate,
    syncTimeoutTimestamp,
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

interface OnlineState {
  isOnline: boolean;
  timestamp: number; // when the state (offline/online) was entered
}

function useIsOnline(): OnlineState {
  const [isOnlineState, setIsOnlineState] = useState<OnlineState>({
    isOnline: navigator.onLine,
    timestamp: Date.now(),
  });

  useEffect(() => {
    const onOnline = () => {
      setIsOnlineState({ isOnline: true, timestamp: Date.now() });
    };

    const onOffline = () => {
      setIsOnlineState({ isOnline: false, timestamp: Date.now() });
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnlineState;
}
