import { Sheet } from "lucide-react";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { next as A } from "@automerge/automerge";
import { DataType } from "@/DocExplorer/doctypes";
import { pick } from "lodash";
import { Annotation, HasPatchworkMetadata } from "@/patchwork/schema";

export type DataGridDoc = HasPatchworkMetadata<never, never> & {
  title: string; // The title of the table

  // NOTE: modeling the data this way does not result in reasonable merges.
  // The correct technique is like this, but we need cursors for
  // arbitrary lists to do that in Automerge:
  // https://mattweidner.com/2022/02/10/collaborative-data-design.html#case-study-a-collaborative-spreadsheet
  data: any[][]; // The data for the table
};
// These are bad unstable anchors but we don't have
// anything better until we model the spreadsheet data in a better way (see above)

export type DataGridDocAnchor = {
  row: number;
  column: number;
};

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: any) => {
  doc.title = "Copy of " + doc.title;
};

const getTitle = (doc: any) => {
  return doc.title || "Mystery Data Grid";
};

export const init = (doc: any) => {
  doc.title = "Untitled Spreadsheet";
  const rows = 100;
  const cols = 26;
  const defaultValue = "";
  doc.data = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => defaultValue)
  );
};

export const includeChangeInHistory = (
  doc: DataGridDoc,
  decodedChange: DecodedChangeWithMetadata
) => {
  const dataObjId = A.getObjectId(doc, "data");
  // GL 3/11/24: this is miserable, we need to collect a whole bunch of object ids
  // for the rows inside the data object in order to filter changes.
  // It'd be much nicer to check "is this change working somewhere within this path".
  const rowObjIds = doc.data.map((_, index) => A.getObjectId(doc.data, index));
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return decodedChange.ops.some(
    (op) =>
      op.obj === dataObjId ||
      rowObjIds.includes(op.obj) ||
      op.obj === commentsObjID
  );
};

export const includePatchInChangeGroup = (patch: A.Patch) =>
  patch.path[0] === "data" || patch.path[0] === "commentThreads";

const promptForAIChangeGroupSummary = ({
  docBefore,
  docAfter,
}: {
  docBefore: DataGridDoc;
  docAfter: DataGridDoc;
}) => {
  return `
  Below are two versions of a spreadsheet document..
  Summarize the changes in this diff in a few words.
  Only return a few words, not a full description. No bullet points.

  If possible, interpret the shapes in a meaningful semantic way, eg:

  added column for emails
  added rows for new participants
  added revenue for March
  removed 3 members from list
  added formula calculating total

  If not, fall back to general visual descriptions:

  edited several cells
  restructured data
  added new rows and columns

  ## Doc before

  ${JSON.stringify(pick(docBefore, ["data"]), null, 2)}

  ## Doc after

  ${JSON.stringify(pick(docAfter, ["data"]), null, 2)}`;
};

const patchesToAnnotations = (
  doc: DataGridDoc,
  docBefore: DataGridDoc,
  patches: A.Patch[]
) => {
  return patches.flatMap((patch): Annotation<DataGridDocAnchor, string>[] => {
    const handledPatchActions = ["splice"];
    if (patch.path[0] !== "data" || !handledPatchActions.includes(patch.action))
      return [];

    // TODO: find a way to show the old value in the annotation
    switch (patch.action) {
      case "splice": {
        return [
          {
            type: "added",
            added: patch.value,
            target: {
              row: patch.path[1] as number,
              column: patch.path[2] as number,
            },
          },
        ];
      }
      case "del":
        // TODO
        return [];

      default:
        throw new Error("invalid patch");
    }
  });
};

export const DataGridDatatype: DataType<
  DataGridDoc,
  DataGridDocAnchor,
  string
> = {
  id: "datagrid",
  name: "Spreadsheet",
  icon: Sheet,
  init,
  getTitle,
  markCopy, // TODO: this shouldn't be here

  includeChangeInHistory,
  includePatchInChangeGroup,

  patchesToAnnotations,

  promptForAIChangeGroupSummary,
};
