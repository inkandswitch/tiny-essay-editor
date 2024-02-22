import { MarkdownDoc } from "@/tee/schema";
import { Patch } from "@automerge/automerge/next";
import { TextPatch } from "./utils";
import { PatchWithAttr } from "@automerge/automerge-wasm";

type PatchGroup = {
  groupStartIndex: number;
  groupEndIndex: number;
  patches: (Patch | TextPatch)[];
};
// This is a quick hacky grouping
// Probably better to iterate over patches rather than groups..?
const groupPatchesByDelimiter =
  (delimiter: string) =>
  (doc: MarkdownDoc, patches: (Patch | TextPatch)[]): PatchGroup[] => {
    if (!doc?.content) return [];
    const patchGroups: PatchGroup[] = [];

    let currentGroup: PatchGroup | null = null;

    const createNewGroupFromPatch = (patch: Patch | TextPatch) => {
      const patchStart = patch.path[1] as number;
      const patchEnd = patchStart + getSizeOfPatch(patch);
      const groupStartIndex =
        doc.content.lastIndexOf(delimiter, patchStart) + 1;
      const groupEndIndex = doc.content.indexOf(delimiter, patchEnd);
      return {
        groupStartIndex: groupStartIndex >= 0 ? groupStartIndex : patchStart,
        groupEndIndex: groupEndIndex >= 0 ? groupEndIndex : patchEnd,
        patches: [patch],
      };
    };

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];
      if (
        patch.path[0] !== "content" ||
        !["splice", "del"].includes(patch.action)
      ) {
        continue;
      }

      const patchStart = patch.path[1] as number;
      const patchEnd = patchStart + getSizeOfPatch(patch);

      if (currentGroup) {
        if (patchStart <= currentGroup.groupEndIndex) {
          currentGroup.patches.push(patch);
          if (patchEnd > currentGroup.groupEndIndex) {
            currentGroup.groupEndIndex = patchEnd;
          }
        } else {
          patchGroups.push(currentGroup);
          currentGroup = createNewGroupFromPatch(patch);
        }
      } else {
        currentGroup = createNewGroupFromPatch(patch);
      }
    }

    if (currentGroup) {
      patchGroups.push(currentGroup);
    }

    return patchGroups;
  };
const getSizeOfPatch = (patch: Patch | TextPatch): number => {
  switch (patch.action) {
    case "del":
      return patch.length;
    case "splice":
      return patch.value.length;
    default:
      throw new Error("unsupported patch type");
  }
};

export const getAttrOfPatch = <T>(
  patch: Patch | PatchWithAttr<T> | TextPatch
): T | undefined => {
  if (patch.action === "replace") {
    return getAttrOfPatch(patch.raw.splice); // todo: this is not correct delete and insert could be from different authors
  }

  return "attr" in patch ? patch.attr : undefined;
};

export const groupPatchesByLine = groupPatchesByDelimiter("\n");
export const groupPatchesByParagraph = groupPatchesByDelimiter("\n\n");
