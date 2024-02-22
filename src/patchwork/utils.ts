import React from "react";
import { DiffWithProvenance } from "./schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { useEffect, useMemo, useRef } from "react";
import { useForceUpdate } from "@/lib/utils";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { lastIndexOf, sortBy } from "lodash";
import { useDebounce } from "./components/Spatial";
import * as wasm from "@automerge/automerge-wasm";

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

interface TextReplacePatch {
  action: "replace";
  path: A.Prop[];
  old: string;
  new: string;
  raw: {
    splice: A.SpliceTextPatch;
    delete: A.DelPatch;
  };
}

interface CombinedDelPatch extends A.DelPatch {
  raw: {
    splice?: A.SpliceTextPatch;
    delete: A.DelPatch;
  };
}

interface CombinedSpliceTextPatch extends A.SpliceTextPatch {
  raw: {
    splice: A.SpliceTextPatch;
    delete?: A.DelPatch;
  };
}

export type TextPatch =
  | TextReplacePatch
  | CombinedDelPatch
  | CombinedSpliceTextPatch
  | A.SpliceTextPatch
  | A.DelPatch;

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
        const insertHasAnEffect = inserted.length > overlapStart;
        const deleteHasAnEffect = deleted.length > overlapStart;

        if (insertHasAnEffect) {
          combinedPatches.push({
            ...currentPatch,
            path: ["content", currentPatch.path[1] + overlapStart],
            value: inserted.slice(overlapStart),
            raw: {
              splice: currentPatch,
              delete: !deleteHasAnEffect ? nextPatch : undefined,
            },
          });
        }

        if (deleteHasAnEffect) {
          const removed = deleted.slice(overlapStart);

          combinedPatches.push({
            ...nextPatch,
            length: removed.length,
            removed,
            raw: {
              splice: !insertHasAnEffect ? currentPatch : undefined,
              delete: nextPatch,
            },
          });
        }

        i++;
        continue;
      }

      const overlapEnd = getOverlapEnd(inserted, deleted);

      if (overlapEnd > 0) {
        const insertHasAnEffect = inserted.length > overlapEnd;
        const deleteHasAnEffect = deleted.length > overlapEnd;

        if (insertHasAnEffect) {
          combinedPatches.push({
            ...currentPatch,
            value: inserted.slice(0, inserted.length - overlapEnd),
            raw: {
              splice: currentPatch,
              delete: !deleteHasAnEffect ? nextPatch : undefined,
            },
          });
        }

        if (deleteHasAnEffect) {
          const removed = deleted.slice(0, deleted.length - overlapEnd);

          combinedPatches.push({
            ...nextPatch,
            path: ["content", (nextPatch.path[1] as number) - overlapEnd],
            length: removed.length,
            removed,
            raw: {
              splice: !insertHasAnEffect ? currentPatch : undefined,
              delete: nextPatch,
            },
          });
        }

        i++;
        continue;
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
        raw: {
          splice: currentPatch,
          delete: nextPatch,
        },
      });
      i++; // skip next patch
    } else {
      patchesWithReplaces.push(currentPatch);
    }
  }

  return patchesWithReplaces;
};

// only creates overlap if the strings overlap on full words
// Example: str1: "Here text", str2: "Here next" would return 5 ("Here ...")
const getOverlapStart = (str1: string, str2: string) => {
  if (str1 === str2) {
    return str1.length;
  }

  const lastWordStart = str1.lastIndexOf(" ") + 1;

  let overlapLength = 0;
  for (
    let i = 0;
    i < str1.length && i < str2.length && i < lastWordStart;
    i++
  ) {
    if (str1[i] === str2[i]) {
      overlapLength++;
    } else {
      break;
    }
  }

  return overlapLength;
};

// only creates overlap if the strings overlap on full words
// Example: str1: "Text here", str2: "Test here" would return 5 ("... here")
const getOverlapEnd = (str1: string, str2: string) => {
  if (str1 === str2) {
    return str1.length;
  }

  const firstWordStart = str1.indexOf(" ") - 1;
  let overlapLength = 0;

  const minLength = Math.min(str1.length, str2.length);
  for (let i = 1; i <= minLength && i < firstWordStart; i++) {
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

export function getCursorPositionSafely(
  doc: A.Doc<unknown>,
  path: A.Prop[],
  cursor: A.Cursor
): number | null {
  try {
    return A.getCursorPosition(doc, path, cursor);
  } catch (err) {
    return null;
  }
}

// this creates a copy of the document with only the changes up until the passed in heads
// some functions like A.merge in automerge don't work with view documents
// if you need to pass a document at a certain heads to these functions use copyDocAtHeads instead
export const copyDocAtHeads = <T>(doc: A.Doc<T>, heads: A.Heads): A.Doc<T> => {
  const saved = A.save(doc);
  const wasmDoc = wasm.load(saved);
  const extraneousChanges = new Set(
    wasmDoc.getChanges(heads).map((change) => A.decodeChange(change).hash)
  );

  const desiredChanges = A.getAllChanges(doc)
    .map((c) => A.decodeChange(c))
    .filter((change) => !extraneousChanges.has(change.hash))
    .map((change) => A.encodeChange(change));

  let cloned = A.init<T>();
  let [resultDoc] = A.applyChanges(cloned, desiredChanges);

  return resultDoc;
};

// slot config allows 2 options:
// 1. Component to match, example: { leadingVisual: LeadingVisual }
type ComponentMatcher = React.ElementType<Props>;
// 2. Component to match + a test function, example: { blockDescription: [Description, props => props.variant === 'block'] }
type ComponentAndPropsMatcher = [ComponentMatcher, (props: Props) => boolean];

export type SlotConfig = Record<
  string,
  ComponentMatcher | ComponentAndPropsMatcher
>;

// We don't know what the props are yet, we set them later based on slot config
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = any;

type SlotElements<Config extends SlotConfig> = {
  [Property in keyof Config]: SlotValue<Config, Property>;
};

type SlotValue<
  Config,
  Property extends keyof Config
> = Config[Property] extends React.ElementType // config option 1
  ? React.ReactElement<
      React.ComponentPropsWithoutRef<Config[Property]>,
      Config[Property]
    >
  : Config[Property] extends readonly [
      infer ElementType extends React.ElementType, // config option 2, infer array[0] as component
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      infer _testFn // even though we don't use testFn, we need to infer it to support types for slots.*.props
    ]
  ? React.ReactElement<React.ComponentPropsWithoutRef<ElementType>, ElementType>
  : never; // useful for narrowing types, third option is not possible

/**
 * Extract components from `children` so we can render them in different places,
 * allowing us to implement components with SSR-compatible slot APIs.
 * Note: We can only extract direct children, not nested ones.
 */
export function useSlots<Config extends SlotConfig>(
  children: React.ReactNode,
  config: Config
): [Partial<SlotElements<Config>>, React.ReactNode[]] {
  // Object mapping slot names to their elements
  const slots: Partial<SlotElements<Config>> = mapValues(
    config,
    () => undefined
  );

  // Array of elements that are not slots
  const rest: React.ReactNode[] = [];

  const keys = Object.keys(config) as Array<keyof Config>;
  const values = Object.values(config);

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      rest.push(child);
      return;
    }

    const index = values.findIndex((value) => {
      if (Array.isArray(value)) {
        const [component, testFn] = value;
        return child.type === component && testFn(child.props);
      } else {
        return child.type === value;
      }
    });

    // If the child is not a slot, add it to the `rest` array
    if (index === -1) {
      rest.push(child);
      return;
    }

    const slotKey = keys[index];

    // If slot is already filled, ignore duplicates
    if (slots[slotKey]) {
      // warning(
      //   true,
      //   `Found duplicate "${String(slotKey)}" slot. Only the first will be rendered.`
      // )
      return;
    }

    // If the child is a slot, add it to the `slots` object

    slots[slotKey] = child as SlotValue<Config, keyof Config>;
  });

  return [slots, rest];
}

/** Map the values of an object */
function mapValues<T extends Record<string, unknown>, V>(
  obj: T,
  fn: (value: T[keyof T]) => V
) {
  return Object.keys(obj).reduce((result, key: keyof T) => {
    result[key] = fn(obj[key]);
    return result;
  }, {} as Record<keyof T, V>);
}
