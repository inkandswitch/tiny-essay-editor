// Currently this is a loose collection of operations related to the
// MarkdownDoc datatype.
// It will become more structured in future work on schemas / datatypes.

import { next as A } from "@automerge/automerge";
import { Text } from "lucide-react";
import { MarkdownDocAnchor, MarkdownDoc } from "./schema";
import { Doc, splice } from "@automerge/automerge/next";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { DataType } from "@/DocExplorer/doctypes";
import { TextPatch, getCursorPositionSafely } from "@/patchwork/utils";
import { Annotation, initPatchworkMetadata } from "@/patchwork/schema";
import { getCursorSafely } from "@/patchwork/utils";
import { pick } from "lodash";

export const init = (doc: any) => {
  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};

  initPatchworkMetadata(doc);
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

export const isMarkdownDoc = (doc: Doc<unknown>): doc is MarkdownDoc => {
  const typedDoc = doc as MarkdownDoc;
  return !!typedDoc.content && !!typedDoc.commentThreads;
};

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
  return patches.flatMap((patch): Annotation<MarkdownDocAnchor, string>[] => {
    if (
      patch.path[0] !== "content" ||
      !["splice", "del"].includes(patch.action)
    )
      return [];

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
          return [];
        }

        return [
          {
            type: "added",
            added: patch.value,
            target: {
              fromCursor: fromCursor,
              toCursor: toCursor,
            },
          },
        ];
      }
      case "del":
        {
          const patchStart = patch.path[1] as number;
          const patchEnd = (patch.path[1] as number) + 1;
          const fromCursor = getCursorSafely(doc, ["content"], patchStart);
          const toCursor = getCursorSafely(doc, ["content"], patchEnd);

          if (!fromCursor || !toCursor) {
            console.warn("Failed to get cursor for patch", patch);
            return [];
          }

          return [
            {
              type: "deleted",
              deleted: patch.removed,
              target: {
                fromCursor: fromCursor,
                toCursor: toCursor,
              },
            },
          ];
        }

        break;

      // todo: handle replace
      /*   case "replace":
            (patchStart = patch.path[1] as number),
              (patchEnd = Math.min(
                (patch.path[1] as number) + patch.new.length,
                doc.content.length - 1
              ));

            break; */
      default:
        throw new Error("invalid patch");
    }
  });
};

const doAnchorsOverlap = (
  anchor1: MarkdownDocAnchor,
  anchor2: MarkdownDocAnchor,
  doc: MarkdownDoc
) => {
  const from1 = getCursorPositionSafely(doc, ["content"], anchor1.fromCursor);
  const to1 = getCursorPositionSafely(doc, ["content"], anchor1.toCursor);
  const from2 = getCursorPositionSafely(doc, ["content"], anchor2.fromCursor);
  const to2 = getCursorPositionSafely(doc, ["content"], anchor2.toCursor);

  return Math.max(from1, from2) <= Math.min(to1, to2);
};

export const EssayDatatype: DataType<MarkdownDoc, MarkdownDocAnchor, string> = {
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
  doAnchorsOverlap,
};
