import { DiffWithProvenance } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { useEffect, useRef } from "react";
import { useForceUpdate } from "@/lib/utils";
import { useHandle } from "@automerge/automerge-repo-react-hooks";

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

        console.log("change", decodedChange);

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
