import { GenericChangeGroup } from "@/patchwork/groupChanges";

import { TextPatch } from "@/patchwork/utils";
import { Patch } from "@automerge/automerge-wasm";
import { MarkdownDoc } from "./schema";

export type MarkdownDocChangeGroup = {
  /* number of distinct edit ranges */
  editCount: number;

  charsAdded: number;
  charsDeleted: number;
  headings: Heading[];
  commentsAdded: number;
};

export type Heading = {
  index: number;
  text: string;
  patches: Patch[];
};

// Compute stats for a change group on a MarkdownDoc

export const statsForChangeGroup = (
  changeGroup: GenericChangeGroup
): MarkdownDocChangeGroup => {
  const charsAdded = changeGroup.diff.patches.reduce((total, patch) => {
    if (patch.path[0] !== "content") {
      return total;
    }
    if (patch.action === "splice") {
      return total + patch.value.length;
    } else {
      return total;
    }
  }, 0);

  const charsDeleted = changeGroup.diff.patches.reduce((total, patch) => {
    if (patch.path[0] !== "content") {
      return total;
    }
    if (patch.action === "del") {
      return total + patch.length;
    } else {
      return total;
    }
  }, 0);

  const commentsAdded = changeGroup.diff.patches.reduce((total, patch) => {
    const isNewComment =
      patch.path[0] === "commentThreads" &&
      patch.path.length === 4 &&
      patch.action === "insert";

    if (!isNewComment) {
      return total;
    } else {
      return total + 1;
    }
  }, 0);

  const headings = extractHeadings(
    changeGroup.docAtEndOfChangeGroup as MarkdownDoc,
    changeGroup.diff.patches
  );
  const editCount = changeGroup.diff.patches.filter(
    (p) => p.path[0] === "content"
  ).length;

  return {
    editCount,
    charsAdded,
    charsDeleted,
    headings,
    commentsAdded,
  };
};

// This is a MarkdownDoc-specific function that determines whether a change group
// should be shown in the log.
export const showChangeGroupInLog = (
  changeGroup: MarkdownDocChangeGroup & GenericChangeGroup
) => {
  if (
    changeGroup.charsAdded === 0 &&
    changeGroup.charsDeleted === 0 &&
    changeGroup.commentsAdded === 0
  ) {
    return false;
  } else {
    return true;
  }
};

// todo: doesn't handle replace
export const extractHeadings = (
  doc: MarkdownDoc,
  patches: (Patch | TextPatch)[]
): Heading[] => {
  const headingData: Heading[] = [];
  const regex = /^##\s(.*)/gm;
  let match;

  while ((match = regex.exec(doc.content)) != null) {
    headingData.push({ index: match.index, text: match[1], patches: [] });
  }

  for (const patch of patches) {
    if (
      patch.path[0] !== "content" ||
      !["splice", "del"].includes(patch.action)
    ) {
      continue;
    }
    let patchStart: number, patchEnd: number;
    switch (patch.action) {
      case "del": {
        patchStart = patch.path[1] as number;
        patchEnd = patchStart + patch.length;
        break;
      }
      case "splice": {
        patchStart = patch.path[1] as number;
        patchEnd = patchStart + patch.value.length;
        break;
      }
      default: {
        continue;
      }
    }

    // The heading was edited if it overlaps with the patch.
    for (let i = 0; i < headingData.length; i++) {
      const heading = headingData[i];
      if (heading.index >= patchStart && heading.index <= patchEnd) {
        heading.patches.push(patch);
      }
      if (
        heading.index < patchStart &&
        headingData[i + 1]?.index > patchStart
      ) {
        heading.patches.push(patch);
      }
    }
  }

  return headingData;
};
export const charsAddedAndDeletedByPatches = (
  patches: Patch[]
): { charsAdded: number; charsDeleted: number } => {
  return patches.reduce(
    (acc, patch) => {
      if (patch.action === "splice") {
        acc.charsAdded += patch.value.length;
      } else if (patch.action === "del") {
        acc.charsDeleted += patch.length;
      }
      return acc;
    },
    { charsAdded: 0, charsDeleted: 0 }
  );
};
