import { DiffWithProvenance, MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import * as A from "@automerge/automerge/next";
import { diffWithProvenance, useActorIdToAuthorMap } from "../utils";
import { combineRedundantPatches } from "../utils";
import { arraysAreEqual } from "@/DocExplorer/utils";
import { isEqual } from "lodash";

export const EditGroupsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const actorIdToAuthor = useActorIdToAuthorMap(docUrl);

  const lastTag = doc?.tags?.slice(-1)[0];
  const diffBase = useMemo(() => {
    const heads = lastTag?.heads ?? [];

    return JSON.parse(JSON.stringify(heads)); // strip any automerge metadata from the heads
  }, [lastTag?.heads]);

  const unreviewedEditGroups = doc
    ? Object.values(doc.drafts ?? {}).filter((draft) => {
        return (
          !draft.reviews ||
          (Object.values(draft.reviews).length === 0 &&
            arraysAreEqual(draft.fromHeads, diffBase))
        );
      })
    : [];

  const diff: DiffWithProvenance | undefined = useMemo(() => {
    if (!doc || diffBase.length === 0) return undefined;
    const diff = diffWithProvenance(
      doc,
      diffBase,
      A.getHeads(doc),
      actorIdToAuthor
    );

    return {
      ...diff,
      patches: combineRedundantPatches(diff.patches),
    };
  }, [doc]);

  if (!doc) return <div>Loading...</div>;

  return (
    <div className="h-full overflow-hidden">
      <div className="flex p-1 font-mono text-xs">
        <div className="mr-4 flex items-center">
          <div className="mr-1">Showing edits since:</div>
          {lastTag?.name ?? "Initial"}
        </div>

        <div className="flex-1"></div>

        <div className="mr-2">
          <>
            {unreviewedEditGroups.length > 0 && (
              <span className="pl-1">
                {unreviewedEditGroups.length} unreviewed{" "}
                {unreviewedEditGroups.length === 1 ? "change" : "changes"}
              </span>
            )}
          </>
        </div>
      </div>
      <TinyEssayEditor
        diffBase={diffBase}
        docUrl={docUrl}
        key={docUrl}
        diff={diff}
        showDiffAsComments
        actorIdToAuthor={actorIdToAuthor}
      />
    </div>
  );
};
