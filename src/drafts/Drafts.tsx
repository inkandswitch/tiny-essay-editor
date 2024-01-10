import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useMemo, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { getRelativeTimeString } from "@/DocExplorer/utils";
import { truncate } from "lodash";
import { getHeads } from "@automerge/automerge/next";
import { markCopy } from "@/tee/datatype";
import { PlusIcon } from "lucide-react";

export const DraftsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [selectedDraftUrl, setSelectedDraftUrl] = useState<AutomergeUrl | null>(
    null
  );
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(false);

  console.log({ selectedDraftUrl });

  if (!doc) return <div>Loading...</div>;
  if (!doc.copyMetadata)
    return (
      <div className="p-8">
        <div className="mb-2">
          This doc doesn't yet have the metadata needed for drafts, because it
          was created in older TEE.
        </div>
        <Button
          onClick={() =>
            changeDoc(
              (doc) =>
                (doc.copyMetadata = {
                  source: null,
                  copies: [],
                })
            )
          }
        >
          Initialize metadata
        </Button>
      </div>
    );

  const drafts = doc.copyMetadata.copies;

  const createDraft = () => {
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    const newHandle = repo.clone<MarkdownDoc>(docHandle);
    newHandle.change((doc) => {
      doc.copyMetadata.source = {
        url: docUrl,
        copyHeads: getHeads(doc),
      };
    });
    docHandle.change((doc) => {
      doc.copyMetadata.copies.unshift({
        name: "Untitled Draft",
        copyTimestamp: Date.now(),
        url: newHandle.url,
        copyHeads: getHeads(newHandle.docSync()),
      });
    });
    setSelectedDraftUrl(newHandle.url);
  };

  const mergeDraft = (draftUrl: AutomergeUrl) => {
    const draftHandle = repo.find<MarkdownDoc>(draftUrl);
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    docHandle.merge(draftHandle);
    docHandle.change((doc) => {
      const index = doc.copyMetadata.copies.findIndex(
        (copy) => copy.url === draftUrl
      );
      if (index !== -1) {
        doc.copyMetadata.copies.splice(index, 1);
      }
    });
  };

  console.log({ diffHeads: getHeads(doc) });

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div>
          <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
            Main
          </div>

          <div className="overflow-y-auto flex-grow border-t border-gray-400 mb-2">
            <div
              className={`p-2 border-b border-gray-400 cursor-default ${
                selectedDraftUrl === null ? "bg-blue-100" : ""
              }`}
              onClick={() => setSelectedDraftUrl(null)}
            >
              <div className="text-xs font-bold">Main Version</div>
            </div>
          </div>
        </div>

        <div className="">
          <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
            Drafts
          </div>

          <Button
            className="mx-2 my-1"
            variant="outline"
            size="sm"
            onClick={createDraft}
          >
            <PlusIcon className="mr-2" size={12} />
            Create new draft
          </Button>

          <div className="overflow-y-auto flex-grow border-t border-gray-400">
            {drafts.map((draft) => (
              <div
                className={`p-2 border-b border-gray-400 cursor-default ${
                  draft.url === selectedDraftUrl ? "bg-blue-100" : ""
                }`}
                onClick={() => setSelectedDraftUrl(draft.url)}
              >
                <div className="text-xs font-bold">{draft.name}</div>
                <div className="text-xs text-gray-500">
                  {truncate(draft.url, { length: 25 })}
                </div>
                <div className="text-xs text-gray-500">
                  created {getRelativeTimeString(draft.copyTimestamp)}
                </div>
                <Button
                  className="mt-2 font-semibold text-xs"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    mergeDraft(draft.url);
                    setSelectedDraftUrl(null);
                    e.stopPropagation();
                  }}
                >
                  Merge to main
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="p-2 h-8 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
          <div className="flex items-center">
            {selectedDraftUrl && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={showDiffOverlay}
                  onChange={(e) => setShowDiffOverlay(e.target.checked)}
                />
                <label className="ml-2">Show diff overlay</label>
              </div>
            )}
          </div>
        </div>
        <TinyEssayEditor
          docUrl={selectedDraftUrl || docUrl}
          key={docUrl}
          diffHeads={showDiffOverlay ? getHeads(doc) : undefined}
        />
      </div>
    </div>
  );
};
