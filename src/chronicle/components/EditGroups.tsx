import { DiffWithProvenance, MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import * as A from "@automerge/automerge/next";
import { Hash } from "./Hash";
import { diffWithProvenance, useActorIdToAuthorMap } from "../utils";
import { sortBy } from "lodash";

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
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(true);
  const [diffBase, setDiffBase] = useState<A.Heads>([]);
  const actorIdToAuthor = useActorIdToAuthorMap(docUrl);

  useEffect(() => {
    if (!doc) return;
    setDiffBase(inferDiffBase(doc));
  }, [doc]);

  const diff: DiffWithProvenance | undefined = useMemo(() => {
    if (!doc || diffBase.length === 0) return undefined;
    const diff = diffWithProvenance(doc, diffBase, A.getHeads(doc), actorIdToAuthor);

    return {
      ...diff,
      patches: filterUndoPatches(diff.patches)
    }
  }, [doc, diffBase]);

  if (!doc) return <div>Loading...</div>;

  return (
    <div className="h-full overflow-hidden">
      <div className="flex p-1 font-mono text-xs font-semibold">
        <div className="mr-4 flex">
          <div>Diff base</div>
          {diffBase.map((hash) => (
            <Hash key={hash} hash={hash} />
          ))}
        </div>
        <div className="flex items-center">
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
      </div>
      <TinyEssayEditor
        docUrl={docUrl}
        key={docUrl}
        diff={showDiffOverlay ? diff : undefined}
        showDiffAsComments
      />
    </div>
  );
};


const filterUndoPatches = (patches: A.Patch[]) => {
  let filteredPatches: A.Patch[] = [];

  for (let i = 0; i < patches.length; i++) {
    let currentPatch = patches[i];
    let nextPatch = patches[i + 1];
    

    if (nextPatch) {
      console.log(currentPatch.path[1],  )
    }

    // Skip if the current and next patches cancel each other out
    if (
      nextPatch &&    
      currentPatch.path[0] === "content" &&
      nextPatch.path[0] === "content" &&  
      currentPatch.action === 'splice' &&
      nextPatch.action === 'del' &&
      currentPatch.path[1] === ((nextPatch.path[1] as number) -  currentPatch.value.length)
    ) {
      const deleted = nextPatch.removed
      const inserted = currentPatch.value
        if (inserted.length > deleted.length && inserted.startsWith(deleted)) {
          const partialInsertPatch = {
            ...currentPatch,
            path: ["content", currentPatch.path[1] + deleted.length],
            value: inserted.slice(deleted.length)
          }
          filteredPatches.push(partialInsertPatch)

        i+= 2; // Skip patches
        continue;

        } else if (deleted.length > inserted.length && deleted.startsWith(inserted)) {
          const removed = deleted.slice(inserted.length)
          const partialDeletePatch = {
            ...nextPatch,
            path: ["content", currentPatch.path[1] - inserted.length],
            length: removed.length, 
            removed
          }
          filteredPatches.push(partialDeletePatch)

        i+= 2; // Skip patches
        continue;
        } else if (deleted === inserted)  {
          i+= 2; // Skip patches
          continue;
        }

    }
    
    // If the patches don't cancel each other out, add the current patch to the filtered patches
    filteredPatches.push(currentPatch);
  }
  
  const result =  sortBy(filteredPatches, (patch) => patch.path[1]);

  console.log(patches, result)

  return result
};


