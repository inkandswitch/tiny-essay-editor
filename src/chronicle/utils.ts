import { DiffWithProvenance } from "@/tee/schema";
import * as A from "@automerge/automerge/next";

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
export const diffWithProvenanceAndAttribution = (
  doc: A.Doc<any>,
  fromHeads: A.Heads,
  toHeads: A.Heads
): DiffWithProvenance => {
  const patches = diffWithAttributionToAuthors(doc, fromHeads, toHeads);

  console.log("patches", patches);

  return {
    fromHeads,
    toHeads,
    patches,
  };
};

// A helper that returns a diff with patches attributed to authors
export const diffWithAttributionToAuthors = (
  doc: A.Doc<any>,
  fromHeads: A.Heads,
  toHeads: A.Heads
): A.Patch[] => {
  const actorIdToAuthor = {};
  A.getAllChanges(doc).map((change) => {
    const decodedChange = A.decodeChange(change);

    let metadata;
    try {
      metadata = JSON.parse(decodedChange.message);
    } catch (e) {}

    actorIdToAuthor[decodedChange.actor] = {
      author: metadata?.author,
      time: decodedChange.time,
    };
  });

  return A.diffWithAttribution(doc, fromHeads, toHeads, actorIdToAuthor);
};
