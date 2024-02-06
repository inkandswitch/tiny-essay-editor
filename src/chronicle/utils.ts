import { DiffWithProvenance } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { useEffect, useMemo, useRef } from "react";
import { useForceUpdate } from "@/lib/utils";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { sortBy } from "lodash";
import { useDebounce } from "./components/Spatial";

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

interface ReplacePatch {
  action: "replace";
  path: A.Prop[];
  old: string;
  new: string;
  splice: A.SpliceTextPatch;
  delete: A.DelPatch;
}

export type TextPatch = A.SpliceTextPatch | A.DelPatch | ReplacePatch;

// combines patches in two phases
// 1. eliminates redudant patches like a insert followed by and delete of the same characters
// 2. turns an insert followed by a delete into a replace (that's probably wrong, but we will refine that later)
export const combinePatches = (
  patches: (A.Patch | TextPatch)[]
): TextPatch[] => {
  let combinedPatches: TextPatch[] = [];

  // 1. combine redundant pathces

  for (let i = 0; i < patches.length; i++) {
    let currentPatch = patches[i];
    let nextPatch = patches[i + 1];

    // filter out non text patches
    if (currentPatch.action !== "splice" && currentPatch.action !== "del") {
      continue;
    }

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
          combinedPatches.push({
            ...currentPatch,
            path: ["content", currentPatch.path[1] + overlapStart],
            value: inserted.slice(overlapStart),
          });
        }

        if (deleted.length > overlapStart) {
          const removed = deleted.slice(overlapStart);

          combinedPatches.push({
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
            combinedPatches.push({
              ...currentPatch,
              value: inserted.slice(0, inserted.length - overlapEnd),
            });
          }

          if (deleted.length > overlapEnd) {
            const removed = deleted.slice(0, deleted.length - overlapEnd);

            combinedPatches.push({
              ...nextPatch,
              path: ["content", (nextPatch.path[1] as number) - overlapEnd],
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
    combinedPatches.push(currentPatch);
  }

  // make sure they are sorted
  combinedPatches = sortBy(combinedPatches, (patch) => patch.path[1]);

  // 2. turn subsequent insert deletes into replaces
  const patchesWithReplaces: TextPatch[] = [];

  for (let i = 0; i < combinedPatches.length; i++) {
    let currentPatch = combinedPatches[i];
    let nextPatch = combinedPatches[i + 1];

    if (
      nextPatch &&
      currentPatch.path[0] === "content" &&
      nextPatch.path[0] === "content" &&
      currentPatch.action === "splice" &&
      nextPatch.action === "del" &&
      currentPatch.path[1] ===
        (nextPatch.path[1] as number) - currentPatch.value.length
    ) {
      patchesWithReplaces.push({
        action: "replace",
        path: currentPatch.path,
        old: nextPatch.removed,
        new: currentPatch.value,
        splice: currentPatch,
        delete: nextPatch,
      });
      i++; // skip next patch
    } else {
      patchesWithReplaces.push(currentPatch);
    }
  }

  return patchesWithReplaces;
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

// debounced heads history
export const useHeadsHistory = (url: AutomergeUrl): A.Heads[] => {
  const [doc] = useDocument<unknown>(url);
  const debouncedDoc = useDebounce(doc);

  return useMemo(() => {
    if (!doc) {
      return [];
    }

    let tempDoc = A.init();

    const headsHistory: A.Heads[] = [];

    A.getAllChanges(doc).forEach((change) => {
      [tempDoc] = A.applyChanges(tempDoc, [change]);

      headsHistory.push(A.getHeads(tempDoc));
    });

    return headsHistory;
  }, [debouncedDoc]);
};
