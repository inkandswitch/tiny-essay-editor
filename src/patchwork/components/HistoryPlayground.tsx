import { MarkdownDoc } from "@/tee/schema";
import { DiffWithProvenance } from "../schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";

import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDiffIcon } from "lucide-react";
import { MinimapWithDiff } from "./MinimapWithDiff";
import { Heads, view } from "@automerge/automerge/next";
import { ConfigurableHistoryLog } from "./ConfigurableHistoryLog";

type MainPaneView = "wholeDoc" | "snippets";

export const HistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc] = useDocument<MarkdownDoc>(docUrl);

  const [docHeads, setDocHeads] = useState<Heads | undefined>(undefined);
  const [diff, setDiff] = useState<DiffWithProvenance | undefined>(undefined);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  // The view mode for the main pane (either "wholeDoc" or "snippets")
  const [mainPaneView, setMainPaneView] = useState<MainPaneView>("wholeDoc");

  // the document state at the end of the selected change groups
  const docAtHeads = docHeads ? view(doc, docHeads) : doc;

  return (
    <div className="flex overflow-y-hidden h-full ">
      <ConfigurableHistoryLog
        docUrl={docUrl}
        setDiff={setDiff}
        setDocHeads={setDocHeads}
      />
      <div className="flex-grow overflow-hidden">
        <div className="h-8 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
          {docHeads && (
            <div className="flex items-center p-1">
              <Select
                value={mainPaneView}
                onValueChange={(value) => setMainPaneView(value as any)}
              >
                <SelectTrigger className="h-6 text-xs mr-2 max-w-36">
                  <SelectValue placeholder="View Mode" />
                </SelectTrigger>
                <SelectContent>
                  {["wholeDoc", "snippets"].map((key) => (
                    <SelectItem key={key} value={key}>
                      {key === "wholeDoc" ? "Whole doc" : "Diff Snippets"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex mr-6">
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
          )}
          {!docHeads && (
            <div className="p-2 text-gray-500">
              Select a changeset to view history
            </div>
          )}
        </div>
        {mainPaneView === "wholeDoc" && docUrl && (
          <>
            <TinyEssayEditor
              docUrl={docUrl}
              key={docUrl}
              readOnly={docHeads !== undefined}
              docHeads={docHeads}
              diff={showDiffInDoc ? diff : undefined}
            />
            {doc && diff && showDiffInDoc && (
              <div className="absolute top-20 right-6">
                <MinimapWithDiff doc={docAtHeads} patches={diff.patches} />
              </div>
            )}
          </>
        )}
        {mainPaneView === "snippets" && docUrl && (
          <>
            <TinyEssayEditor
              docUrl={docUrl}
              key={`${docUrl}:${docHeads}`}
              readOnly
              docHeads={docHeads}
              diff={showDiffInDoc ? diff : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
};
