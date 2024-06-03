import { DataType } from "@/os/datatypes";
import { FileExportMethod } from "@/os/fileExports";
import { DecodedChangeWithMetadata } from "@/os/versionControl/groupChanges";
import {
  Annotation,
  initVersionControlMetadata,
} from "@/os/versionControl/schema";
import {
  TextPatch,
  getCursorPositionSafely,
  getCursorSafely,
} from "@/os/versionControl/utils";
import { next as A } from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { splice } from "@automerge/automerge/next";
import { pick } from "lodash";
import { Text } from "lucide-react";
import { AssetsDoc } from "../../tools/essay/assets";
import { MarkdownDoc, MarkdownDocAnchor } from "./schema";
import { unpatchAll } from "@onsetsoftware/automerge-patcher";

import JSZip from "jszip";

export const init = (doc: any, repo: Repo) => {
  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};

  initVersionControlMetadata(doc);
  const handle = repo.create<AssetsDoc>();
  handle.change((doc) => {
    doc.files = {};
  });

  doc.assetsDocUrl = handle.url;
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: MarkdownDoc) => {
  const firstHeadingIndex = doc.content.search(/^#\s.*$/m);
  if (firstHeadingIndex !== -1) {
    splice(doc, ["content"], firstHeadingIndex + 2, 0, "Copy of ");
  }
};

export const asMarkdownFile = (doc: MarkdownDoc): Blob => {
  return new Blob([doc.content], { type: "text/markdown" });
}; // Helper to get the title of one of our markdown docs.
// looks first for yaml frontmatter from the i&s essay format;
// then looks for the first H1.

export const getTitle = async (doc: MarkdownDoc) => {
  const content = doc.content;
  const frontmatterRegex = /---\n([\s\S]+?)\n---/;
  const frontmatterMatch = content.match(frontmatterRegex);
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";

  const titleRegex = /title:\s"(.+?)"/;
  const subtitleRegex = /subtitle:\s"(.+?)"/;

  const titleMatch = frontmatter.match(titleRegex);
  const subtitleMatch = frontmatter.match(subtitleRegex);

  let title = titleMatch ? titleMatch[1] : null;
  const subtitle = subtitleMatch ? subtitleMatch[1] : "";

  // If title not found in frontmatter, find first markdown heading
  if (!title) {
    const titleFallbackRegex = /(^|\n)#\s(.+)/;
    const titleFallbackMatch = content.match(titleFallbackRegex);
    title = titleFallbackMatch ? titleFallbackMatch[2] : "Untitled";
  }

  return `${title} ${subtitle && `: ${subtitle}`}`;
};

export const includeChangeInHistory = (doc: MarkdownDoc) => {
  const contentObjID = A.getObjectId(doc, "content");
  const commentsObjID = A.getObjectId(doc, "commentThreads");
  return (decodedChange: DecodedChangeWithMetadata) => {
    return decodedChange.ops.some(
      (op) => op.obj === contentObjID || op.obj === commentsObjID
    );
  };
};

export const includePatchInChangeGroup = (patch: A.Patch | TextPatch) =>
  patch.path[0] === "content" || patch.path[0] === "commentThreads";

const promptForAIChangeGroupSummary = ({
  docBefore,
  docAfter,
}: {
  docBefore: MarkdownDoc;
  docAfter: MarkdownDoc;
}) => {
  return `
Summarize the changes in this diff in a few words.

Only return a few words, not a full description. No bullet points.

Here are some good examples of descriptive summaries:

wrote initial outline
changed title
small wording changes
turned outline into prose
lots of small edits
total rewrite
a few small tweaks
reworded a paragraph

## Doc before

${JSON.stringify(pick(docBefore, ["content", "commentThreads"]), null, 2)}

## Doc after

${JSON.stringify(pick(docAfter, ["content", "commentThreads"]), null, 2)}`;
};

export const patchesToAnnotations = (
  doc: MarkdownDoc,
  docBefore: MarkdownDoc,
  patches: A.Patch[]
) => {
  const filteredPatches = patches.filter(
    (patch) =>
      patch.path[0] === "content" &&
      (patch.action === "splice" || patch.action === "del")
  );

  const inversePatches = unpatchAll(docBefore, filteredPatches).reverse();

  const annotations: Annotation<MarkdownDocAnchor, string>[] = [];

  // We keep track of the offset between doc and docBefore.
  //
  // - everytime we encounter an insert we add the length of the inserted string
  // - everytime we encounter a delete we subtract the number of deleted characters
  //
  // We can then translate positions in the new doc to positions in the old doc by subtracting the offset
  //
  // Note: we can't use cursors for this position translation because the cursor functions
  // always operate on the most recent version of a document even if you pass in a document at some heads
  let offset = 0;

  for (let i = 0; i < filteredPatches.length; i++) {
    const patch = filteredPatches[i];

    switch (patch.action) {
      case "splice": {
        const patchStart = patch.path[1] as number;
        const patchEnd = Math.min(
          (patch.path[1] as number) + patch.value.length,
          doc.content.length - 1
        );
        const fromCursor = getCursorSafely(doc, ["content"], patchStart);
        const toCursor = getCursorSafely(doc, ["content"], patchEnd);

        if (!fromCursor || !toCursor) {
          console.warn("Failed to get cursor for patch", patch);
          break;
        }

        const nextPatch = filteredPatches[i + 1];
        if (
          nextPatch &&
          nextPatch.action === "del" &&
          nextPatch.path[1] === patchEnd
        ) {
          const deleted = docBefore.content.slice(
            patchStart - offset,
            patchStart - offset + nextPatch.length
          );
          const inserted = patch.value;
          const overlapStart = getOverlapStart(inserted, deleted);
          const overlapEnd = getOverlapEnd(inserted, deleted);
          const inverseInsertAndDelete = [
            inversePatches[i + 1],
            inversePatches[i],
          ];

          // handle overlap at the beginning
          if (overlapStart > 0) {
            const insertHasEffect = inserted.length > overlapStart;
            const deleteHasEffect = deleted.length > overlapStart;

            if (insertHasEffect && !deleteHasEffect) {
              annotations.push({
                type: "added",
                added: inserted.slice(overlapStart),
                anchor: {
                  fromCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchStart + overlapStart
                  ),
                  toCursor,
                },
                inversePatches: inverseInsertAndDelete,
              });
            }

            if (!insertHasEffect && deleteHasEffect) {
              annotations.push({
                type: "deleted",
                deleted: deleted.slice(overlapStart),
                anchor: {
                  fromCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchStart + overlapStart
                  ),
                  toCursor,
                },
                inversePatches: inverseInsertAndDelete,
              });
            }

            if (insertHasEffect && deleteHasEffect) {
              annotations.push({
                type: "changed",
                before: deleted.slice(overlapStart),
                after: inserted.slice(overlapStart),
                anchor: {
                  fromCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchStart + overlapStart
                  ),
                  toCursor,
                },
                inversePatches: inverseInsertAndDelete,
              });
            }

            // handle overlap at the end
          } else if (overlapEnd > 0) {
            const deleteHasEffect = inserted.length > overlapStart;
            const insertHasEffect = deleted.length > overlapStart;

            if (deleteHasEffect && !insertHasEffect) {
              annotations.push({
                type: "added",
                added: inserted.slice(0, -overlapEnd),
                anchor: {
                  fromCursor,
                  toCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchEnd - overlapEnd
                  ),
                },
                inversePatches: inverseInsertAndDelete,
              });
            }

            if (insertHasEffect && !deleteHasEffect) {
              annotations.push({
                type: "deleted",
                deleted: deleted.slice(0, -overlapEnd),
                anchor: {
                  fromCursor,
                  toCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchEnd - overlapEnd
                  ),
                },
                inversePatches: inverseInsertAndDelete,
              });
            }

            if (insertHasEffect && deleteHasEffect) {
              annotations.push({
                type: "changed",
                before: deleted.slice(0, -overlapEnd),
                after: inserted.slice(0, -overlapEnd),
                anchor: {
                  fromCursor,
                  toCursor: getCursorSafely(
                    doc,
                    ["content"],
                    patchEnd - overlapEnd
                  ),
                },
                inversePatches: inverseInsertAndDelete,
              });
            }
            // no overlap
          } else {
            annotations.push({
              type: "changed",
              before: deleted,
              after: inserted,
              anchor: {
                fromCursor,
                toCursor,
              },
              inversePatches: inverseInsertAndDelete,
            });
          }

          offset += patch.value.length - nextPatch.length;
          i += 1;
        } else {
          annotations.push({
            type: "added",
            added: patch.value,
            anchor: {
              fromCursor: fromCursor,
              toCursor: toCursor,
            },
            inversePatches: [inversePatches[i]],
          });

          offset += patch.value.length;
        }
        break;
      }
      case "del": {
        const patchStart = patch.path[1] as number;
        const cursor = getCursorSafely(doc, ["content"], patchStart);

        const patchLength = patch.length ?? 1; // length is undefined if only one character is deleted
        const deleted = docBefore.content.slice(
          patchStart - offset,
          patchStart - offset + patchLength
        );

        offset -= patch.length;

        if (!cursor) {
          console.warn("Failed to get cursor for patch", patch);
          break;
        }

        annotations.push({
          type: "deleted",
          deleted,
          anchor: {
            fromCursor: cursor,
            toCursor: cursor,
          },
          inversePatches: [inversePatches[i]],
        });
        break;
      }

      default:
        throw new Error("invalid patch");
    }
  }

  return annotations;
};

const WORD_SEPARATOR_REGEX = /[\s.,:;?!(){}[\]<>]/;

const getOverlapStart = (str1: string, str2: string) => {
  // full match
  if (str1 === str2) {
    return str1.length;
  }

  // partial match
  let overlapLength = 0;
  for (let i = 0; i < str1.length && i < str2.length; i++) {
    if (str1[i] === str2[i]) {
      overlapLength++;
    } else {
      break;
    }
  }

  // reduce the overlap if this is not a full word
  while (
    overlapLength > 0 &&
    !WORD_SEPARATOR_REGEX.test(str1[overlapLength - 1])
  ) {
    overlapLength--;
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

const valueOfAnchor = (doc: MarkdownDoc, anchor: MarkdownDocAnchor) => {
  const from = getCursorPositionSafely(doc, ["content"], anchor.fromCursor);
  const to = getCursorPositionSafely(doc, ["content"], anchor.toCursor);

  // if the anchor points to an empty range return undefined
  // so highlight comments that point to this will be filtered out
  if (from === to) {
    return undefined;
  }

  return doc.content.slice(from, to);
};

const doAnchorsOverlap = (
  doc: MarkdownDoc,
  anchor1: MarkdownDocAnchor,
  anchor2: MarkdownDocAnchor
) => {
  const from1 = getCursorPositionSafely(doc, ["content"], anchor1.fromCursor);
  const to1 = getCursorPositionSafely(doc, ["content"], anchor1.toCursor);
  const from2 = getCursorPositionSafely(doc, ["content"], anchor2.fromCursor);
  const to2 = getCursorPositionSafely(doc, ["content"], anchor2.toCursor);

  return Math.max(from1, from2) <= Math.min(to1, to2);
};

const sortAnchorsBy = (doc: MarkdownDoc, anchor: MarkdownDocAnchor) => {
  return getCursorPositionSafely(doc, ["content"], anchor.fromCursor);
};

const fileExportMethods: FileExportMethod<MarkdownDoc>[] = [
  {
    id: "markdown",
    name: "Markdown",
    export: (doc) => asMarkdownFile(doc),
    contentType: "text/markdown",
    extension: "md",
  },
  {
    id: "markdown-with-assets",
    name: "Markdown + Assets (.zip)",
    export: async (doc, repo) => {
      // export a zip file with the markdown file and the assets folder
      const assetsDoc = await repo.find<AssetsDoc>(doc.assetsDocUrl).doc();

      const zip = new JSZip();
      zip.file("index.md", doc.content);
      for (const [filename, file] of Object.entries(assetsDoc.files)) {
        zip.file(`assets/${filename}`, file.contents);
      }

      const uintarray = await zip.generateAsync({ type: "uint8array" });
      return new Blob([uintarray], { type: "application/zip" });
    },
    contentType: "application/zip",
    extension: "zip",
  },
];

export const MarkdownDatatype: DataType<
  MarkdownDoc,
  MarkdownDocAnchor,
  string
> = {
  id: "essay",
  name: "Essay",
  icon: Text,
  init,
  getTitle,
  markCopy,
  includeChangeInHistory,
  includePatchInChangeGroup,
  promptForAIChangeGroupSummary,
  patchesToAnnotations,
  valueOfAnchor,
  doAnchorsOverlap,
  sortAnchorsBy,
  fileExportMethods,
  supportsInlineComments: true, // todo: this should be part of the viewer
};
