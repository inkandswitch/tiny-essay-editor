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
export const diffWithProvenance = (
  doc: A.Doc<any>,
  fromHeads: A.Heads,
  toHeads: A.Heads
): DiffWithProvenance => {
  const patches = A.diff(doc, fromHeads, toHeads);

  console.log("patches", patches);
  debugger;

  return {
    fromHeads,
    toHeads,
    patches,
  };
};
