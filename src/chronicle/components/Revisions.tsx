import { Checkbox } from "@/components/ui/checkbox";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { FileDiffIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

import { next as A } from "@automerge/automerge";
import { CopyIcon } from "lucide-react";
import { hashToColor } from "../utils";

const Hash: React.FC<{ hash: string }> = ({ hash }) => {
  const color = useMemo(() => hashToColor(hash), [hash]);

  return (
    <div className="inline-flex items-center border border-gray-300 rounded-full pl-1">
      <div
        className="w-2 h-2 rounded-full mr-[2px]"
        style={{ backgroundColor: color }}
      ></div>
      <div>{hash.substring(0, 6)}</div>
      <div
        className="cursor-pointer px-1 ml-1 hover:bg-gray-50 active:bg-gray-200 rounded-full"
        onClick={() => {
          navigator.clipboard.writeText(hash);
        }}
      >
        <CopyIcon size={10} />
      </div>
    </div>
  );
};

export const RevisionsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  const revisions = useMemo(() => {
    if (!doc) {
      return [];
    }

    const changes = A.getAllChanges(doc);

    let tempDoc = A.init<MarkdownDoc>();

    for (const change of changes) {
      const decodedChange = A.decodeChange(change);

      [tempDoc] = A.applyChanges(tempDoc, [change]);
    }

    return [];
  }, [doc]);

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-y-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="p-1">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Revisions
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="h-8 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono flex items-center px-2 gap-4">
          <div className="flex">
            <Checkbox
              id="show-diff-overlay"
              className="mr-1"
              checked={showDiffInDoc}
              onCheckedChange={() => setShowDiffInDoc(!showDiffInDoc)}
            >
              Diff Overlay
            </Checkbox>
            <label htmlFor="show-diff-overlay" className="mr-4">
              <FileDiffIcon size={12} className="mr-1 inline" />
              Show Diff
            </label>
          </div>
        </div>
        {false && docUrl && (
          <TinyEssayEditor docUrl={docUrl} key={docUrl} diff={[]} />
        )}
      </div>
    </div>
  );
};
