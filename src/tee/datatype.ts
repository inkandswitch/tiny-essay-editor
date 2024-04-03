// Currently this is a loose collection of operations related to the
// MarkdownDoc datatype.
// It will become more structured in future work on schemas / datatypes.

import { Text } from "lucide-react";
import { MarkdownDoc } from "./schema";
import { next as A } from "@automerge/automerge";
import { Annotation, DataType, Discussion } from "@/DocExplorer/doctypes";
import { getCursorPositionSafely } from "./utils";

export const init = (doc: any) => {
  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: MarkdownDoc) => {
  const firstHeadingIndex = doc.content.search(/^#\s.*$/m);
  if (firstHeadingIndex !== -1) {
    A.splice(doc, ["content"], firstHeadingIndex + 2, 0, "Copy of ");
  }
};

export const asMarkdownFile = (doc: MarkdownDoc): Blob => {
  return new Blob([doc.content], { type: "text/markdown" });
}; // Helper to get the title of one of our markdown docs.
// looks first for yaml frontmatter from the i&s essay format;
// then looks for the first H1.

export const getTitle = (doc: any) => {
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

export const getAnnotations = (
  doc: MarkdownDoc,
  docBefore: MarkdownDoc,
  patches: A.Patch[],
  discussions: Discussion<MarkdownDocAnchor>[]
) => {
  const annotations: Annotation<MarkdownDocAnchor, string>[] = [];

  for (const discussion of discussions) {
    for (const anchor of discussion.target) {
      const from = getCursorPositionSafely(doc, ["content"], anchor.fromCursor);
      const to = getCursorPositionSafely(doc, ["content"], anchor.toCursor);

      if (from === null || to === null) {
        continue;
      }

      annotations.push({
        type: "highlighted",
        target: anchor,
        value: doc.content.slice(from, to),
      });
    }
  }

  return annotations;
};

export const EssayDatatype: DataType<MarkdownDoc, MarkdownDocAnchor, string> = {
  id: "essay",
  name: "Essay",
  icon: Text,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
  getAnnotations,
};

export type MarkdownDocAnchor = {
  fromCursor: A.Cursor;
  toCursor: A.Cursor;
};

export type ResolvedMarkdownDocAnchor = MarkdownDocAnchor & {
  fromPos: number;
  toPos: number;
};
