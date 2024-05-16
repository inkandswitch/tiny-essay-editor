import { DataType } from "@/os/datatypes";
import { DecodedChangeWithMetadata } from "@/os/versionControl/groupChanges";
import { Annotation } from "@/os/versionControl/schema";
import { next as A } from "@automerge/automerge";
import { pick } from "lodash";
import { Sheet } from "lucide-react";
import { DataGridDoc, DataGridDocAnchor } from "./schema";

// When a copy of the document has been made,
// update the title so it's more clear which one is the copy vs original.
// (this mechanism needs to be thought out more...)
export const markCopy = (doc: DataGridDoc) => {
  doc.title = "Copy of " + doc.title;
};

const setTitle = async (doc: DataGridDoc, title: string) => {
  doc.title = title;
};

const getTitle = async (doc: DataGridDoc) => {
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

export const includeChangeInHistory = (doc: DataGridDoc) => {
  const dataObjId = A.getObjectId(doc, "data");
  // GL 3/11/24: this is miserable, we need to collect a whole bunch of object ids
  // for the rows inside the data object in order to filter changes.
  // It'd be much nicer to check "is this change working somewhere within this path".
  const rowObjIds = doc.data.map((_, index) => A.getObjectId(doc.data, index));
  const commentsObjID = A.getObjectId(doc, "commentThreads");

  return (decodedChange: DecodedChangeWithMetadata) => {
    // todo
    // @ts-ignore
    return decodedChange.ops.some(
      (op) =>
        op.obj === dataObjId ||
        rowObjIds.includes(op.obj) ||
        op.obj === commentsObjID
    );
  };
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
            anchor: {
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
  isExperimental: true,
  icon: Sheet,
  init,
  getTitle,
  setTitle,
  markCopy, // TODO: this shouldn't be here

  includeChangeInHistory,
  includePatchInChangeGroup,

  patchesToAnnotations,

  promptForAIChangeGroupSummary,
};
