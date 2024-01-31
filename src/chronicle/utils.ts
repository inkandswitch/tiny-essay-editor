import { DiffWithProvenance } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { useEffect, useRef } from "react";
import { useForceUpdate } from "@/lib/utils";
import { useHandle } from "@automerge/automerge-repo-react-hooks";
import { sortBy } from "lodash";

// Turns hashes (eg for changes and actors) into colors for scannability
export const hashToColor = (hash: string) => {
  let hashInt = 0;
  for (let i = 0; i < hash.length; i++) {
    hashInt = hash.charCodeAt(i) + ((hashInt << 5) - hashInt);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hashInt >> (i * 8)) & 255;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
};

// A helper that returns a diff and remembers what the heads were that went into it
export const diffWithProvenance = (
  doc: A.Doc<any>,
  fromHeads: A.Heads,
  toHeads: A.Heads,
  actorIdToAuthor?: Record<A.ActorId, AutomergeUrl>
): DiffWithProvenance => {
  const patches = actorIdToAuthor
    ? A.diffWithAttribution(doc, fromHeads, toHeads, actorIdToAuthor)
    : A.diff(doc, fromHeads, toHeads);

  return {
    fromHeads,
    toHeads,
    patches,
  };
};

// hook to create an incrementally maintained map of actorId -> authorUrl
export const useActorIdToAuthorMap = (
  url: AutomergeUrl
): Record<A.ActorId, AutomergeUrl> => {
  const handle = useHandle<any>(url);
  const forceUpdate = useForceUpdate();
  const actorIdToAuthorRef = useRef<Record<A.ActorId, AutomergeUrl>>({});

  useEffect(() => {
    let lastHeads: A.Heads;

    const addChangesToActorIdMap = (changes: A.Change[]) => {
      changes.map((change) => {
        const decodedChange = A.decodeChange(change);

        let metadata;
        try {
          metadata = JSON.parse(decodedChange.message);
        } catch (e) {}

        actorIdToAuthorRef.current[decodedChange.actor] = metadata?.author;
      });

      forceUpdate();
    };

    handle.doc().then((doc) => {
      lastHeads = A.getHeads(doc);
      addChangesToActorIdMap(A.getAllChanges(doc));
    });

    const onChange = () => {
      if (!lastHeads) {
        return;
      }

      const doc = handle.docSync();
      const changes = A.getChanges(A.view(doc, lastHeads), doc);
      addChangesToActorIdMap(changes);
    };

    handle.on("change", onChange);

    return () => {
      handle.off("change", onChange);
    };
  }, []);

  return actorIdToAuthorRef.current;
};

// eliminates redudant patches like a insert followed by and delete of the same characters
export const combineRedundantPatches = (patches: A.Patch[]) => {
  let filteredPatches: A.Patch[] = [];

  for (let i = 0; i < patches.length; i++) {
    let currentPatch = patches[i];
    let nextPatch = patches[i + 1];

    // check insert followed by a delete ....
    if (
      nextPatch &&
      currentPatch.path[0] === "content" &&
      nextPatch.path[0] === "content" &&
      currentPatch.action === "splice" &&
      nextPatch.action === "del" &&
      currentPatch.path[1] ===
        (nextPatch.path[1] as number) - currentPatch.value.length
    ) {
      const deleted = nextPatch.removed;
      const inserted = currentPatch.value;

      const overlapStart = getOverlapStart(inserted, deleted);

      // combine if there is some overlap

      if (overlapStart > 0) {
        if (inserted.length > overlapStart) {
          filteredPatches.push({
            ...currentPatch,
            path: ["content", currentPatch.path[1] + overlapStart],
            value: inserted.slice(overlapStart),
          });
        }

        if (deleted.length > overlapStart) {
          const removed = deleted.slice(overlapStart);

          filteredPatches.push({
            ...nextPatch,
            length: removed.length,
            removed,
          });
        }

        i++;
        continue;
      }

      const overlapEnd = getOverlapEnd(inserted, deleted);
      if (overlapEnd > 0) {
        if (overlapEnd > 0) {
          if (inserted.length > overlapEnd) {
            filteredPatches.push({
              ...currentPatch,
              value: inserted.slice(0, inserted.length - overlapEnd),
            });
          }

          if (deleted.length > overlapEnd) {
            const removed = deleted.slice(0, deleted.length - overlapEnd);

            filteredPatches.push({
              ...nextPatch,
              length: removed.length,
              removed,
            });
          }

          i++;
          continue;
        }
      }
    }

    // If the patches don't cancel each other out, add the current patch to the filtered patches
    filteredPatches.push(currentPatch);
  }

  return sortBy(filteredPatches, (patch) => patch.path[1]);
};

const getOverlapStart = (str1: string, str2: string) => {
  let overlapLength = 0;
  for (let i = 0; i < str1.length && i < str2.length; i++) {
    if (str1[i] === str2[i]) {
      overlapLength++;
    } else {
      break;
    }
  }
  return overlapLength;
};

const getOverlapEnd = (str1: string, str2: string) => {
  let overlapLength = 0;
  const minLength = Math.min(str1.length, str2.length);
  for (let i = 1; i <= minLength; i++) {
    if (str1[str1.length - i] === str2[str2.length - i]) {
      overlapLength++;
    } else {
      break;
    }
  }
  return overlapLength;
};
