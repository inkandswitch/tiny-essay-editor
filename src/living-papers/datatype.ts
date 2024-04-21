import { MarkdownDoc } from "@/tee/schema";
import * as MarkdownDatatype from "@/tee/datatype";

import { BookIcon } from "lucide-react";

// Until Patchwork has better multi-doc versioning, we have to keep the
// TEE Markdown content directly in this doc for basic usability.
export type LivingPapersDoc = MarkdownDoc & {
  pdfOutput: Uint8Array;
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  MarkdownDatatype.markCopy(doc);
};

const getTitle = (doc: any) => {
  return MarkdownDatatype.getTitle(doc);
};

export const init = (doc: any) => {
  const initContent = `---
title: Untitled Living Paper
author:
  - name: The Living Papers Team
    org: University of Washington
keywords: [all, about, my, article]
output:
  latex: true
---`;

  doc.content = initContent;
};

export const LivingPapersDatatype = {
  id: "living-papers",
  name: "Living Paper",
  icon: BookIcon,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here
};
