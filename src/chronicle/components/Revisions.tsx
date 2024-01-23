import { Checkbox } from "@/components/ui/checkbox";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { FileDiffIcon } from "lucide-react";
import React, { useMemo, useState } from "react";
import { marked } from "marked";

import { next as A } from "@automerge/automerge";
import { CopyIcon } from "lucide-react";
import { hashToColor } from "../utils";
import { arraysAreEqual } from "@/DocExplorer/utils";

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

    let prevRevision: string[];

    const revisions = [];

    for (const change of changes) {
      [tempDoc] = A.applyChanges(tempDoc, [change]);

      if (!tempDoc.content) {
        continue;
      }

      const newRevision = extractHeadings(tempDoc.content);

      if (!prevRevision || !arraysAreEqual(prevRevision, newRevision)) {
        revisions.unshift(newRevision);
        prevRevision = newRevision;
      }
    }

    return revisions;
  }, [doc]);

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-y-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="p-1 h-full flex flex-col">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Revisions ({revisions.length})
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {revisions.map((revision) => {
              return (
                <div className="border-b border-gray-100 p-2">
                  <pre>{revision.join("\n")}</pre>
                </div>
              );
            })}
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
        {docUrl && <TinyEssayEditor docUrl={docUrl} key={docUrl} diff={[]} />}
      </div>
    </div>
  );
};

function extractHeadings(markdownText: string): string[] {
  let headings = [];

  marked.parse(markdownText, {
    walkTokens: (token) => {
      if (token.type === "heading") {
        headings.push(`${"#".repeat(token.depth)} ${token.text}`);
      }
    },
  });

  return headings;
}
