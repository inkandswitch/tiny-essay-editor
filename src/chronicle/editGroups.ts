import {
  TextAnnotation,
  MarkdownDoc,
  DraftAnnotation,
  PatchAnnotation,
  EditRange,
  PersistedDraft,
} from "@/tee/schema";
import { ChangeFn, uuid } from "@automerge/automerge";

export const createOrGrowEditGroup = (
  annotations: TextAnnotation[],
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void
) => {
  const existingDrafts: DraftAnnotation[] = annotations.filter(
    (thread) => thread.type === "draft"
  ) as DraftAnnotation[];

  const selectedPatches = annotations.filter(
    (annotation) => annotation.type === "patch"
  ) as PatchAnnotation[];

  if (selectedPatches.length === 0) {
    alert("no patches selected");
    return;
  }

  const editRanges: EditRange[] = selectedPatches.map(
    (annotation: PatchAnnotation) => ({
      fromCursor: annotation.fromCursor,
      toCursor: annotation.toCursor,
      fromHeads: annotation.fromHeads,
    })
  );

  // create new draft if all selected patches are virtual
  if (existingDrafts.length == 0) {
    changeDoc((doc) => {
      const draft: PersistedDraft = {
        type: "draft",
        id: uuid(),
        comments: [],
        fromHeads: selectedPatches[0].fromHeads,
        editRangesWithComments: editRanges.map((editRange) => ({
          editRange,
          comments: [],
        })),
        reviews: {},
        // TODO not concurrency safe
        number: Object.values(doc.drafts ?? {}).length + 1,
      };
      // backwards compat for old docs without a drafts field
      if (doc.drafts === undefined) {
        doc.drafts = {};
      }
      doc.drafts[draft.id] = draft;
    });

    // add to existing thread if there is only one
  } else if (existingDrafts.length === 1) {
    const existingDraft = existingDrafts[0];
    changeDoc((doc) => {
      const draft = doc.drafts[existingDraft.id];
      for (const livePatch of editRanges) {
        draft.editRangesWithComments.push({
          editRange: livePatch,
          comments: [],
        });
      }
    });

    // give up if multiple drafts are selected
  } else {
    alert("can't merge two groups");
  }
};
