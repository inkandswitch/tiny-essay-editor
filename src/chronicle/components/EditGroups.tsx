import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import * as A from "@automerge/automerge/next";
import { Hash } from "./Hash";

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

// failed attempt at getting the deleted text in deletion patches
// const diffWithDeletedText = (doc: A.Doc<MarkdownDoc>, from: A.Heads) => {
//   if (!doc || from.length === 0) return [];
//   const to = A.getHeads(doc);
//   console.log("yo", doc, from, to);
//   const diff = A.diff(doc, from, to);
//   const fromDoc = A.view(doc, from);
//   return diff.map((patch) => {
//     if (patch.action !== "del") {
//       return patch;
//     }
//     const patchCursor = A.getCursor(doc, ["content"], patch.path[1]);
//     const positionOfPatchInFromDoc = A.getCursorPosition(
//       fromDoc,
//       ["content"],
//       patchCursor
//     );
//     console.log({ patchCursor, positionOfPatchInFromDoc });
//     return {
//       ...patch,
//       value: fromDoc.content.slice(
//         positionOfPatchInFromDoc,
//         positionOfPatchInFromDoc + patch.length
//       ),
//     };
//   });
// };

export const EditGroupsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(true);
  const [diffBase, setDiffBase] = useState<A.Heads>([]);

  useEffect(() => {
    if (!doc) return;
    setDiffBase(inferDiffBase(doc));
  }, [doc]);

  const diff = useMemo(() => {
    if (!doc || diffBase.length === 0) return [];
    return A.diff(doc, diffBase, A.getHeads(doc));
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
