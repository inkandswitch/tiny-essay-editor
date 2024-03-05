import { next as A } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { ChangeGroup } from "./groupChanges";
import { DiffWithProvenance, HasChangeGroupSummaries } from "./schema";
import { Doc } from "@automerge/automerge";
import { getStringCompletion } from "@/llm";
import { debounce, pick } from "lodash";
import { useCallback, useEffect } from "react";
import { TextPatch } from "./utils";

export const populateChangeGroupSummaries = async <
  T extends HasChangeGroupSummaries
>({
  groups,
  handle,
  force,
  getLLMSummary,
  patchFilter,
}: {
  groups: ChangeGroup<T>[];
  handle: DocHandle<T>;
  force?: boolean;
  getLLMSummary: (doc: T) => string;
  patchFilter?: (patch: A.Patch | TextPatch) => boolean;
}) => {
  handle.change((doc) => {
    if (!doc.changeGroupSummaries) {
      doc.changeGroupSummaries = {};
    }
  });

  for (const [index, group] of groups.entries()) {
    if (!force && handle.docSync().changeGroupSummaries[group.id]) {
      continue;
    }
    await populateGroupSummary({
      group,
      docBefore: groups[index - 1]?.docAtEndOfChangeGroup ?? {},
      handle,
      getLLMSummary,
      patchFilter,
    });
  }
};

const populateGroupSummary = async <T extends HasChangeGroupSummaries>({
  group,
  docBefore,
  handle,
  getLLMSummary,
  patchFilter,
}: {
  group: ChangeGroup<T>;
  docBefore: any;
  handle: DocHandle<T>;
  getLLMSummary: (doc: T) => string;
  patchFilter?: (patch: A.Patch | TextPatch) => boolean;
}) => {
  const docAfter = group.docAtEndOfChangeGroup;
  const summary = await autoSummarizeGroup({
    docBefore,
    docAfter,
    diff: group.diff,
    getLLMSummary,
    patchFilter,
  });

  if (summary) {
    handle.change((doc) => {
      doc.changeGroupSummaries[group.id] = {
        title: summary,
      };
    });
  }
};

// TODO: This thing hardcodes logic specific to TEE docs;
// move that stuff to the TEE datatype somehow...

const autoSummarizeGroup = async <T>({
  docBefore,
  docAfter,
  diff,
  getLLMSummary,
  patchFilter,
}: {
  docBefore: Doc<T>;
  docAfter: Doc<T>;
  diff: DiffWithProvenance;
  getLLMSummary: (doc: T) => string;
  patchFilter?: (patch: A.Patch | TextPatch) => boolean;
}): Promise<string> => {
  let prompt = `
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

${getLLMSummary(docBefore)}

## Doc after

${getLLMSummary(docAfter)}`;

  // todo: adding the diff for tldraw makes the results worse, maybe this should be a config option?
  /*if (patchFilter) {
    prompt += `
## Diff

${JSON.stringify(diff.patches.filter(patchFilter), null, 2)}`;
  } */

  return getStringCompletion(prompt);
};

export const useAutoPopulateChangeGroupSummaries = <
  T extends HasChangeGroupSummaries
>({
  changeGroups,
  handle,
  msBetween = 10000,
  getLLMSummary,
  patchFilter,
}: {
  changeGroups: ChangeGroup<T>[];
  handle: DocHandle<T>;
  msBetween?: number;
  getLLMSummary?: (doc: T) => string;
  patchFilter?: (patch: A.Patch | TextPatch) => boolean;
}) => {
  const debouncedPopulate = useCallback(
    debounce(({ groups, handle, force }) => {
      populateChangeGroupSummaries({
        groups,
        handle,
        force,
        getLLMSummary,
        patchFilter,
      });
    }, msBetween),
    []
  );

  useEffect(() => {
    // can't run chang
    if (!getLLMSummary) {
      return;
    }

    debouncedPopulate({
      groups: changeGroups,
      handle,
    });

    // Cleanup function to cancel the debounce if the component unmounts
    return () => {
      debouncedPopulate.cancel();
    };
  }, [changeGroups, handle, debouncedPopulate, getLLMSummary, patchFilter]);
};
