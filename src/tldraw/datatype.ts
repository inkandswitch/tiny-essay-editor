import { next as A } from "@automerge/automerge";
import { DataType } from "@/DocExplorer/doctypes";
import { init as tldrawinit } from "automerge-tldraw";
import { PenLine } from "lucide-react";
import { TLDrawDoc } from "./schema";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: TLDrawDoc) => {
  doc.store["page:page"].name = "Copy of " + doc.store["page:page"].name;
};

const getTitle = (doc: TLDrawDoc) => {
  return doc.store["page:page"].name || "Drawing";
};

export const init = (doc: TLDrawDoc) => {
  tldrawinit(doc);
  doc.store["page:page"].name = "Drawing";
};

export const includePatchInChangeGroup = (patch: A.Patch) => {
  return patch.path[0] === "store";
};

export const getLLMSummary = (doc: TLDrawDoc) => {
  return Object.values(doc?.store ?? {})
    .flatMap((obj: any) => {
      if (obj.type !== "text") {
        return [];
      }

      return obj.props.text;
    })
    .join("\n");
};

// we filter too agressively here, only edits that create new objects are counted
// todo: figuring out edits of existing is harder
export const includeChangeInHistory = (
  doc: TLDrawDoc,
  decodedChange: DecodedChangeWithMetadata
) => {
  const storeObjId = A.getObjectId(doc, "store");

  return decodedChange.ops.some((op) => op.obj === storeObjId);
};

export const TLDrawDatatype: DataType<TLDrawDoc> = {
  id: "tldraw",
  name: "Drawing",
  icon: PenLine,
  init,
  getTitle,
  markCopy,
  includePatchInChangeGroup,
  includeChangeInHistory,
  //   getLLMSummary,
};
