import { DiffWithProvenance, MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import * as A from "@automerge/automerge/next";
import { Hash } from "./Hash";
import { diffWithProvenance, useActorIdToAuthorMap } from "../utils";
import { combineRedundantPatches } from "../utils";
import clsx from "clsx";
import { arraysAreEqual } from "@/DocExplorer/utils";

const inferDiffBase = (doc: A.Doc<MarkdownDoc>) => {
  const changes = A.getAllChanges(doc);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  let diffBase = [];

  for (let i = changes.length - 1; i >= 0; i--) {
    const change = A.decodeChange(changes[i]);
    diffBase = [change.hash];
    if (change.time < startOfToday.getTime()) {
      break;
    }
  }

  return diffBase;
};

export const EditGroupsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(true);
  const actorIdToAuthor = useActorIdToAuthorMap(docUrl);
  const [selectedDiffBaseIndex, setSelectedDiffBaseIndex] = useState(0);

  const selectedDiffBase = useMemo(() => {
    if (!doc || !doc.diffBaseSnapshots) {
      return [];
    }
    return JSON.parse(
      JSON.stringify(doc.diffBaseSnapshots[selectedDiffBaseIndex])
    ); // turn into raw js object
  }, [doc?.diffBaseSnapshots, selectedDiffBaseIndex]);

  // only set if looking at a previous version
  const documentHeads = useMemo(() => {
    if (!doc || !doc.diffBaseSnapshots || selectedDiffBaseIndex === 0) {
      return undefined;
    }
    return JSON.parse(
      JSON.stringify(doc.diffBaseSnapshots[selectedDiffBaseIndex - 1])
    );
  }, [selectedDiffBaseIndex, doc]);

  // initialize diff base
  useEffect(() => {
    if (!doc || doc.diffBaseSnapshots) return;

    changeDoc((doc) => {
      doc.diffBaseSnapshots = [A.getHeads(doc)];
    });
  }, [doc]);

  const unreviewedEditGroups = doc
    ? Object.values(doc.drafts ?? {}).filter((draft) => {
        return (
          !draft.reviews ||
          (Object.values(draft.reviews).length === 0 &&
            arraysAreEqual(draft.fromHeads, selectedDiffBase))
        );
      })
    : [];

  const onForwardHistory = () => {
    if (
      confirm(
        "Are you sure you want to forward the history? Any edits that are currently highlighted will be no longer reviewable."
      )
    ) {
      changeDoc((doc) => {
        doc.diffBaseSnapshots.unshift(A.getHeads(doc));
      });
    }
  };

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

  const canForwardHistory =
    selectedDiffBaseIndex === 0 &&
    unreviewedEditGroups.length === 0 &&
    !arraysAreEqual(A.getHeads(doc), selectedDiffBase);

  return (
    <div className="h-full overflow-hidden">
      <div className="flex p-1 font-mono text-xs font-semibold">
        <div className="mr-4 flex items-center">
          <div className="mr-1">Diff base:</div>
          {selectedDiffBase.map((hash) => (
            <Hash key={hash} hash={hash} />
          ))}
        </div>
        <div className="flex items-center mr-2">
          <label htmlFor="toggleDiff" className="mr-2">
            Show Diff:
          </label>
          <input
            id="toggleDiff"
            type="checkbox"
            checked={showDiffOverlay}
            onChange={(e) => setShowDiffOverlay(e.target.checked)}
            className="toggle-checkbox"
          />
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

            <button
              className={clsx(`border border-gray-300 rounded p-1`, {
                "opacity-50": !canForwardHistory,
              })}
              disabled={!canForwardHistory}
              onClick={onForwardHistory}
            >
              forward history
            </button>
          </>
        </div>

        <div className="flex gap-1 items-center">
          {(doc?.diffBaseSnapshots ?? []).map((heads, index) => {
            return (
              <button
                className={`w-[15px] h-[16px] bg-gray-500 rounded-full ${
                  selectedDiffBaseIndex === index ? "" : "opacity-50"
                }`}
                onClick={() => setSelectedDiffBaseIndex(index)}
              ></button>
            );
          })}
        </div>
      </div>
      <TinyEssayEditor
        docHeads={documentHeads}
        readOnly={documentHeads !== undefined}
        docUrl={docUrl}
        key={docUrl}
        diff={showDiffOverlay ? diff : undefined}
        showDiffAsComments
      />
    </div>
  );
};

export const getDiffBaseOfDoc = (doc: MarkdownDoc): A.Heads =>
  doc?.diffBaseSnapshots ? doc?.diffBaseSnapshots[0] : [];
