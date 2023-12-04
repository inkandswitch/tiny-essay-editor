import { next as A } from "@automerge/automerge";
import { DocHandle, StorageId, PeerId } from "@automerge/automerge-repo";
import { useState, useEffect, useRef, useContext, createContext } from "react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { WifiIcon, WifiOffIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getRelativeTimeString } from "@/utils";
import { createMachine, raise } from "xstate";
import { useMachine } from "@xstate/react";
import { arraysAreEqual } from "@/utils";

export const SyncIndicator = ({ handle }: { handle: DocHandle<unknown> }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const {
    lastSyncUpdate,
    isInternetConnected,
    syncState,
    syncServerConnectionError,
    syncServerResponseError,
  } = useSyncIndicatorState(handle);

  const isSynced = syncState === SyncState.InSync;

  if (isInternetConnected) {
    if (!syncServerConnectionError && !syncServerResponseError) {
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
                  {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
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
                <dd className="inline text-red-500">
                  {syncServerConnectionError
                    ? "Server not connected"
                    : "Server not responding"}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Last synced:</dt>
                <dd className="inline">
                  {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
                </dd>
              </div>
              <div>
                <dt className="font-bold inline mr-1">Sync status:</dt>
                <dd className="inline">
                  {syncState === SyncState.Unknown ? (
                    "-"
                  ) : syncState === SyncState.InSync ? (
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
                {lastSyncUpdate ? getRelativeTimeString(lastSyncUpdate) : "-"}
              </dd>
            </div>
            <div>
              <dt className="font-bold inline mr-1">Sync status:</dt>
              <dd className="inline">
                {syncState === SyncState.Unknown ? (
                  "-"
                ) : isSynced ? (
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

const SYNC_SERVER_STORAGE_ID =
  "37915c96-8df9-4fa6-8058-1360edd2ebe2" as StorageId;

enum SyncState {
  InSync,
  OutOfSync,
  Unknown,
}

interface SyncIndicatorState {
  lastSyncUpdate?: number;
  isInternetConnected: boolean;
  syncState: SyncState;
  syncServerConnectionError: boolean;
  syncServerResponseError: boolean;
}

function useSyncIndicatorState(handle: DocHandle<unknown>): SyncIndicatorState {
  const repo = useRepo();
  const [lastSyncUpdate, setLastSyncUpdate] = useState<number | undefined>(); // todo: should load that from persisted sync state

  useEffect(() => {
    repo.subscribeToRemotes([SYNC_SERVER_STORAGE_ID]);
  }, [repo]);

  const [machine, send] = useMachine(() => {
    return getSyncIndicatorMachine({
      connectionInitTimeout: 1000,
      maxSyncMessageDelay: 1000,
      isInternetConnected: navigator.onLine,
      isSyncServerConnected: true,
    });
  });

  // online / offline listener
  useEffect(() => {
    const onOnline = () => {
      send("INTERNET_CONNECTED");
    };

    const onOffline = () => {
      send("INTERNET_DISCONNECTED");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [send]);

  // sync server connect / disconnect handling
  // todo: need reachability information for that

  // heads change listener
  useEffect(() => {
    if (machine.matches("sync.unknown")) {
      const remoteHeads = handle.getRemoteHeads(SYNC_SERVER_STORAGE_ID);

      if (
        remoteHeads &&
        arraysAreEqual(remoteHeads, A.getHeads(handle.docSync()))
      ) {
        send("IS_IN_SYNC");
      } else {
        send("IS_OUT_OF_SYNC");
      }
    }

    const onChange = () => {
      send("IS_OUT_OF_SYNC");
    };

    const onRemoteHeads = ({ storageId, heads }) => {
      if (storageId === SYNC_SERVER_STORAGE_ID) {
        if (arraysAreEqual(heads, A.getHeads(handle.docSync()))) {
          send("IS_IN_SYNC");
        } else {
          send("IS_OUT_OF_SYNC");
        }

        setLastSyncUpdate(Date.now());
      }
    };

    handle.on("change", onChange);
    handle.on("remote-heads", onRemoteHeads);

    return () => {
      handle.off("change", onChange);
      handle.off("remote-heads", onRemoteHeads);
    };
  }, [handle]);

  return {
    lastSyncUpdate,
    isInternetConnected: machine.matches("internet.connected"),
    syncState: machine.matches("sync.unknown")
      ? SyncState.Unknown
      : machine.matches("sync.inSync")
      ? SyncState.InSync
      : SyncState.OutOfSync,

    // todo: add reachability check, currently this value will be always true
    syncServerConnectionError: machine.matches("syncServer.disconnected.error"),
    syncServerResponseError: machine.matches("sync.outOfSync.error"),
  };
}

interface SyncIndicatorMachineConfig {
  // the duration we wait for the sync server to respond in the unsynced state before we show an error
  // the timer starts once both internet.connected and sync.isOutOfSync become true
  connectionInitTimeout: number;

  // the duration we wait for the sync server to respond in the unsynced state before we show an error
  // the timer starts once both internet.connected and sync.isOutOfSync become true
  maxSyncMessageDelay: number;

  // initial internet connection state
  isInternetConnected?: boolean;

  // initial sync server connection state
  isSyncServerConnected?: boolean;

  // initial is sync state
  isInSync?: boolean;
}

export function getSyncIndicatorMachine({
  connectionInitTimeout,
  maxSyncMessageDelay,
  isInternetConnected = false,
  isSyncServerConnected = false,
}: SyncIndicatorMachineConfig) {
  return createMachine(
    {
      predictableActionArguments: true,
      id: "syncIndicator",
      type: "parallel",
      states: {
        internet: {
          initial: isInternetConnected ? "connected" : "disconnected",
          states: {
            connected: {
              after: {
                [connectionInitTimeout]: {
                  actions: "connectionInitTimeout",
                },
              },
              on: {
                INTERNET_DISCONNECTED: "disconnected",
              },
            },
            disconnected: {
              on: {
                INTERNET_CONNECTED: "connected",
              },
            },
          },
        },
        sync: {
          initial: "unknown",
          states: {
            unknown: {
              on: {
                IS_OUT_OF_SYNC: "outOfSync",
                IS_IN_SYNC: "inSync",
              },
            },
            inSync: {
              on: {
                IS_OUT_OF_SYNC: "outOfSync",
              },
            },
            outOfSync: {
              initial: "ok",
              after: {
                // every time we re-enter the out of sync state the timeout gets reset
                [maxSyncMessageDelay]: {
                  target: ".error",
                  in: "internet.connected",
                },
              },
              on: {
                IS_IN_SYNC: "inSync",
                RECEIVED_SYNC_MESSAGE: "outOfSync",
                CONNECTION_INIT_TIMEOUT: "outOfSync",
              },
              states: {
                ok: {},
                error: {},
              },
            },
          },
        },
        syncServer: {
          initial: isSyncServerConnected ? "connected" : "disconnected",
          states: {
            connected: {
              on: {
                SYNC_SERVER_DISCONNECTED: "disconnected.error",
              },
            },
            disconnected: {
              initial: "ok",
              on: {
                SYNC_SERVER_CONNECTED: "connected",
                CONNECTION_INIT_TIMEOUT: ".error",
              },
              states: {
                ok: {},
                error: {},
              },
            },
          },
        },
      },
    },
    {
      actions: {
        connectionInitTimeout: raise({ type: "CONNECTION_INIT_TIMEOUT" }),
      },
    }
  );
}
