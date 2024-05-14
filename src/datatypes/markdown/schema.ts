import { HasPatchworkMetadata } from "@/patchwork/schema";
import * as A from "@automerge/automerge/next";
import { HasAssets } from "../../tools/essay/assets";

// todo: split content of document and metadata
// currently branches copy also global metadata
// unclear if comments should be part of the doc or the content
export type MarkdownDoc = HasPatchworkMetadata<MarkdownDocAnchor, string> &
  HasAssets & {
    content: string;
  };

export type MarkdownDocAnchor = {
  fromCursor: A.Cursor;
  toCursor: A.Cursor;
};

export type ResolvedMarkdownDocAnchor = MarkdownDocAnchor & {
  fromPos: number;
  toPos: number;
};
