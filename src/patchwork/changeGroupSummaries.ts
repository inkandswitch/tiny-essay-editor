import { DocHandle } from "@automerge/automerge-repo";
import { ChangeGroup } from "./groupChanges";
import { HasChangeGroupSummaries } from "./schema";
import { getStringCompletion } from "@/llm";
import { debounce } from "lodash";
import { useCallback, useEffect } from "react";

export const populateChangeGroupSummaries = async <
  T extends HasChangeGroupSummaries
>({
  groups,
  handle,
  force,
  promptForAutoChangeGroupDescription,
}: {
  groups: ChangeGroup<T>[];
  handle: DocHandle<T>;
  force?: boolean;
  promptForAutoChangeGroupDescription: (args: {
    docBefore: T;
    docAfter: T;
  }) => string;
}) => {
  handle.change((doc) => {
    if (!doc.changeGroupSummaries) {
      doc.changeGroupSummaries = {};
    }
  });

  // We can't run the summary if we don't have a way to summarize the doc
  if (!promptForAutoChangeGroupDescription) {
    console.info(
      "skipping AI auto-summarization; no LLM prompt spec'd for datatype"
    );
    return;
  }

  for (const [index, group] of groups.entries()) {
    if (!force && handle.docSync().changeGroupSummaries[group.id]) {
      continue;
    }
    await populateGroupSummary({
      group,
      docBefore: groups[index - 1]?.docAtEndOfChangeGroup ?? {},
      handle,
      promptForAutoChangeGroupDescription,
    });
  }
};

const populateGroupSummary = async <T extends HasChangeGroupSummaries>({
  group,
  docBefore,
  handle,
  promptForAutoChangeGroupDescription,
}: {
  group: ChangeGroup<T>;
  docBefore: any;
  handle: DocHandle<T>;
  promptForAutoChangeGroupDescription: (args: {
    docBefore: T;
    docAfter: T;
  }) => string;
}) => {
  const docAfter = group.docAtEndOfChangeGroup;
  const prompt = promptForAutoChangeGroupDescription({
    docBefore,
    docAfter,
  });

  const summary = await getStringCompletion(prompt);

  if (summary) {
    handle.change((doc) => {
      doc.changeGroupSummaries[group.id] = {
        title: summary,
      };
    });
  }
};

export const useAutoPopulateChangeGroupSummaries = <
  T extends HasChangeGroupSummaries
>({
  changeGroups,
  handle,
  msBetween = 10000,
  promptForAutoChangeGroupDescription,
}: {
  changeGroups: ChangeGroup<T>[];
  handle: DocHandle<T>;
  msBetween?: number;
  promptForAutoChangeGroupDescription: (args: {
    docBefore: T;
    docAfter: T;
  }) => string;
}) => {
  const debouncedPopulate = useCallback(
    debounce(({ groups, handle, force }) => {
      populateChangeGroupSummaries({
        groups,
        handle,
        force,
        promptForAutoChangeGroupDescription,
      });
    }, msBetween),
    []
  );

  useEffect(() => {
    debouncedPopulate({
      groups: changeGroups,
      handle,
    });

    // Cleanup function to cancel the debounce if the component unmounts
    return () => {
      debouncedPopulate.cancel();
    };
  }, [
    changeGroups,
    handle,
    debouncedPopulate,
    promptForAutoChangeGroupDescription,
  ]);
};
