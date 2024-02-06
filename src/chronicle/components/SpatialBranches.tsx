import { Button } from "@/components/ui/button";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { PlusIcon } from "lucide-react";
import React from "react";

export const SpatialBranchesPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="">
          <div className="flex items-center m-2">
            <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
              Branches
            </div>

            <div className="ml-auto mr-1">
              <Button
                className=""
                variant="outline"
                size="sm"
                onClick={() => {}}
              >
                <PlusIcon className="mr-2" size={12} />
                New branch
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-grow border-t border-gray-400">
            {[].map((branch, index) => (
              <div key={branch.heads.join(",")}>Branch #{index}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-hidden">
        <TinyEssayEditor docUrl={docUrl} key={docUrl} />
      </div>
    </div>
  );
};
