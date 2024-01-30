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

    // Skip if the current and next patches cancel each other out
    if (
      nextPatch &&
      currentPatch.path[0] === "content" &&
      nextPatch.path[0] === "content" &&
      currentPatch.action === 'splice' &&
      nextPatch.action === 'del' &&
      currentPatch.path[1] === ((nextPatch.path[1] as number) - currentPatch.value.length)
    ) {
      const deleted = nextPatch.removed
      const inserted = currentPatch.value

      // if they have different length we have to be careful and see if they match at the start or end
      if (inserted.length > deleted.length) {
        if (inserted.startsWith(deleted)) {
          const partialInsertPatch = {
            ...currentPatch,
            path: ["content", currentPatch.path[1] + deleted.length],
            value: inserted.slice(deleted.length)
          }
          filteredPatches.push(partialInsertPatch)

          i++; // Skip patches
          continue;      
        } else if (inserted.endsWith(deleted)) {
          const partialInsertPatch = {
            ...currentPatch,
            value: inserted.slice(0, inserted.length - deleted.length)
          }
          filteredPatches.push(partialInsertPatch)

          i++; // Skip patches
          continue;
        } 

      } else if (deleted.length > inserted.length) {
        if (deleted.startsWith(inserted)) {  
          const removed = deleted.slice(inserted.length)
          const partialDeletePatch = {
            ...nextPatch,
            length: removed.length,
            removed
          }
          filteredPatches.push(partialDeletePatch)

          i++; // Skip patches
          continue;
        } else if (deleted.endsWith(inserted)) {
          const removed = deleted.slice(0, deleted.length - inserted.length)
          const partialDeletePatch = {
            ...nextPatch,
            length: removed.length,
            removed
          }
          filteredPatches.push(partialDeletePatch)

          i++; // Skip patches
          continue;
        } 
      } else if (deleted === inserted) {
        i++; // Skip patches
        continue;
      }

    }

    // If the patches don't cancel each other out, add the current patch to the filtered patches
    filteredPatches.push(currentPatch);
  }

  return sortBy(filteredPatches, (patch) => patch.path[1]);
};
