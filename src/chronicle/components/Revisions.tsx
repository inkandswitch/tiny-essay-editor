import { Checkbox } from "@/components/ui/checkbox";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { FileDiffIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";

import { next as A } from "@automerge/automerge";
import { CopyIcon } from "lucide-react";
import { hashToColor } from "../utils";
import clsx from "clsx";

interface Heading {
  text: string;
  isNew: boolean;
}

interface Revision {
  heads: A.Heads[];
  headings: Heading[];
  combineWithPrevious?: boolean;
  i: number;
}

export const RevisionsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState<number>(0);

  const revisions = useMemo(() => {
    if (!doc) {
      return [];
    }

    const changes = A.getAllChanges(doc);

    let tempDoc = A.init<MarkdownDoc>();

    const revisions: Revision[] = [];
    let prevRevision: Revision;

    let i = 0;

    for (const change of changes) {
      i++;

      [tempDoc] = A.applyChanges(tempDoc, [change]);

      if (!tempDoc.content) {
        continue;
      }

      const currentRevision: Revision = {
        headings: extractHeadings(tempDoc.content),
        heads: A.getHeads(tempDoc),
        i,
      };

      // when is first revision create a new active revision
      if (!prevRevision) {
        currentRevision.headings.forEach((heading) => (heading.isNew = true));
        prevRevision = currentRevision;
        continue;
      }

      let addNewRevision = false;

      // compare
      for (let i = 0; i < currentRevision.headings.length; i++) {
        const prevHeading = prevRevision.headings[i];
        const currentHeading = currentRevision.headings[i];

        if (
          !prevHeading ||
          (prevHeading.text !== currentHeading.text && !prevHeading.isNew)
        ) {
          addNewRevision = true;
          currentHeading.isNew = true;
          continue;
        }
      }

      if (addNewRevision) {
        revisions.unshift(prevRevision);
        prevRevision = currentRevision;
      } else {
        // set is new heading
        currentRevision.headings.forEach(
          (heading, index) =>
            (heading.isNew = prevRevision.headings[index].isNew)
        );
        prevRevision = currentRevision;
      }
    }

    if (prevRevision) {
      revisions.unshift(prevRevision);
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
            {revisions.map((revision, index) => {
              return (
                <div
                  className={clsx("border-b border-gray-200 p-2", {
                    "bg-blue-100": index === selectedRevisionIndex,
                    "opacity-50": revision.combineWithPrevious,
                  })}
                  key={index}
                  onClick={() => setSelectedRevisionIndex(index)}
                >
                  {revision.headings.map((heading, index) => (
                    <div
                      key={index}
                      className={clsx({ "text-green-500": heading.isNew })}
                    >
                      {heading.text}
                    </div>
                  ))}
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
        {docUrl && (
          <TinyEssayEditor
            docUrl={docUrl}
            docHeads={
              selectedRevisionIndex !== 0
                ? revisions[selectedRevisionIndex].heads
                : undefined
            }
            key={docUrl}
            diff={[]}
            readOnly={selectedRevisionIndex !== 0}
          />
        )}
      </div>
    </div>
  );
};

function extractHeadings(markdownText: string): Heading[] {
  let headings: Heading[] = [];

  marked.parse(markdownText, {
    walkTokens: (token) => {
      if (token.type === "heading") {
        headings.push({
          text: `${"#".repeat(token.depth)} ${token.text}`,
          isNew: false,
        });
      }
    },
  });

  return headings;
}
