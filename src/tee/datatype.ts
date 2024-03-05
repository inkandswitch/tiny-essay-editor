// Currently this is a loose collection of operations related to the
// MarkdownDoc datatype.
// It will become more structured in future work on schemas / datatypes.

import { next as A } from "@automerge/automerge";
import { Text } from "lucide-react";
import { MarkdownDoc } from "./schema";
import { splice } from "@automerge/automerge/next";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { DataType } from "@/DocExplorer/doctypes";

export const init = (doc: any) => {
  doc.content = "# Untitled\n\n";
  doc.commentThreads = {};

  // TODO: these init values should not be in the MarkdownDoc init;
  // they should come from the other specific schemas.
  doc.branchMetadata = {
    source: null,
    branches: [],
  };
  doc.discussions = {};
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

export const includeChangeInHistory = (
  doc: MarkdownDoc,
  decodedChange: DecodedChangeWithMetadata
) => {
  const contentObjID = A.getObjectId(doc, "content");
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return decodedChange.ops.some(
    (op) => op.obj === contentObjID || op.obj === commentsObjID
  );
};

export const EssayDatatype: DataType<MarkdownDoc> = {
  id: "essay",
  name: "Essay",
  icon: Text,
  init,
  getTitle,
  markCopy,
  includeChangeInHistory,
  //includePatchInChangeGroup,
};
