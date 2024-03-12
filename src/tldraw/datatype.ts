import { next as A } from "@automerge/automerge";
import { DataType } from "@/DocExplorer/doctypes";
import { init as tldrawinit } from "automerge-tldraw";
import { PenLine } from "lucide-react";
import { TLDrawDoc } from "./schema";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { pick } from "lodash";

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

// We filter conservatively with a deny-list because dealing with edits on a nested schema is annoying.
// Would be better to filter with an allow-list but that's tricky with current Automerge APIs.
export const includeChangeInHistory = (
  doc: TLDrawDoc,
  decodedChange: DecodedChangeWithMetadata
) => {
  const metadataObjIds = [
    "branchMetadata",
    "tags",
    "diffBase",
    "discussions",
    "changeGroupSummaries",
  ].map((path) => A.getObjectId(doc, path));

  const result = decodedChange.ops.every(
    (op) => !metadataObjIds.includes(op.obj)
  );
  console.log("includeChangeInHistory", decodedChange, result, metadataObjIds);
  return result;
};

const promptForAutoChangeGroupDescription = ({
  docBefore,
  docAfter,
}: {
  docBefore: TLDrawDoc;
  docAfter: TLDrawDoc;
}) => {
  return `
Below are two versions of a drawing in TLDraw, stored as JSON.
Summarize the changes in this diff in a few words.
Only return a few words, not a full description. No bullet points.

If possible, interpret the shapes in a meaningful semantic way, eg:

drew mockup of simple UI
edited text from "kitchen" to "bathroom"
grew diagram of system architecture

If not, fall back to general visual descriptions:

drew some new rectangles
moved some shapes to the left
deleted shapes from the top-right corner
recolored some shapes from red to blue

## Doc before

${JSON.stringify(pick(docBefore, ["store"]), null, 2)}

## Doc after

${JSON.stringify(pick(docAfter, ["store"]), null, 2)}`;
};

export const TLDrawDatatype: DataType<TLDrawDoc, never, never> = {
  id: "tldraw",
  name: "Drawing",
  icon: PenLine,
  init,
  getTitle,
  markCopy,
  includePatchInChangeGroup,
  includeChangeInHistory,
  promptForAutoChangeGroupDescription,
};
