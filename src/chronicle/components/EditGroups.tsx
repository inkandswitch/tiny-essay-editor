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
  const selectedDiffBase = doc?.diffBase ?? [];

  const tagForDiffBase = doc?.tags?.find((tag) =>
    isEqual(tag.heads, selectedDiffBase)
  );

  // Initialize the diff base to the latest tag if it's not set
  useEffect(() => {
    if (doc === undefined) return;
    if (doc.diffBase) return;
    if (!doc.tags || doc.tags.length === 0) return;

    changeDoc((doc) => {
      doc.diffBase = JSON.parse(JSON.stringify(doc.tags?.slice(-1)[0].heads));
    });
  }, [doc === undefined]);

  const unreviewedEditGroups = doc
    ? Object.values(doc.drafts ?? {}).filter((draft) => {
        return (
          !draft.reviews ||
          (Object.values(draft.reviews).length === 0 &&
            arraysAreEqual(draft.fromHeads, selectedDiffBase))
        );
      })
    : [];

  const diff: DiffWithProvenance | undefined = useMemo(() => {
    if (!doc || selectedDiffBase.length === 0) return undefined;
    const diff = diffWithProvenance(
      doc,
      selectedDiffBase,
      A.getHeads(doc),
      actorIdToAuthor
    );

    return {
      ...diff,
      patches: combineRedundantPatches(diff.patches),
    };
  }, [doc, selectedDiffBase]);

  if (!doc) return <div>Loading...</div>;

  return (
    <div className="h-full overflow-hidden">
      <div className="flex p-1 font-mono text-xs">
        <div className="mr-4 flex items-center">
          <div className="mr-1">Show edits since:</div>
          <select
            value={tagForDiffBase ? tagForDiffBase.heads.join(",") : ""}
            onChange={(e) => {
              if (
                !window.confirm(
                  "Warning: this will change the diff base for all users. Continue?"
                )
              )
                return;
              changeDoc((doc) => {
                const newDiffBase =
                  doc.tags.find((tag) => tag.heads.join(",") === e.target.value)
                    ?.heads ?? [];
                doc.diffBase = JSON.parse(JSON.stringify(newDiffBase));
              });
            }}
            className="h-6 text-xs w-[160px] text-black"
          >
            <option value="">Select Tag</option>
            {(doc.tags ?? []).map((tag) => (
              <option key={tag.heads.join(",")} value={tag.heads.join(",")}>
                {tag.name}
              </option>
            ))}
          </select>
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
        diffBase={selectedDiffBase}
        docUrl={docUrl}
        key={docUrl}
        diff={diff}
        showDiffAsComments
        actorIdToAuthor={actorIdToAuthor}
      />
    </div>
  );
};
