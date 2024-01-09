import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useMemo, useState } from "react";
import { getGroupedChanges } from "../utils";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { GROUPINGS } from "../utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncate } from "lodash";

const hashToColor = (hash: string) => {
  let hashInt = 0;
  for (let i = 0; i < hash.length; i++) {
    hashInt = hash.charCodeAt(i) + ((hashInt << 5) - hashInt);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hashInt >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
};

const Hash: React.FC<{ hash: string }> = ({ hash }) => {
  const color = useMemo(() => hashToColor(hash), [hash]);

  return (
    <div className="inline-flex items-center border border-gray-300 rounded-full px-1">
      <div
        className="w-2 h-2 rounded-full mr-[2px]"
        style={{ backgroundColor: color }}
      ></div>
      <div>{hash.substring(0, 6)}</div>
    </div>
  );
};

export const HistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const [selectedChangeId, setSelectedChangeId] = React.useState<
    string | null
  >();
  const [showInlineDiff, setShowInlineDiff] = useState<boolean>(false);
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(true);

  const [activeGroupingAlgorithm, setActiveGroupingAlgorithm] =
    useState<keyof typeof GROUPINGS>("ActorAndMaxSize");

  const groupedChanges = useMemo(() => {
    if (!doc) return [];
    return getGroupedChanges(doc, activeGroupingAlgorithm);
  }, [doc, activeGroupingAlgorithm]);

  // TODO: is the heads for a group always the id of the group?
  // for now it works because the id of the group is the last change in the group
  const docHeads = selectedChangeId ? [selectedChangeId] : undefined;

  const headsForDisplay =
    docHeads?.map((head) => <Hash key={head} hash={head} />) || "latest";

  const selectedChangeIndex = groupedChanges.findIndex(
    (changeGroup) => changeGroup.id === selectedChangeId
  );
  const diffHeads =
    selectedChangeIndex < groupedChanges.length - 1
      ? [groupedChanges[selectedChangeIndex + 1].id]
      : [];

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="p-1">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Change log
          </div>
          <div className="flex justify-between mb-1">
            <div className="flex items-center">
              <div className="text-xs  mr-2">Group by</div>

              <Select
                value={activeGroupingAlgorithm}
                onValueChange={(value) =>
                  setActiveGroupingAlgorithm(value as any)
                }
              >
                <SelectTrigger className="h-6 text-xs w-[160px]">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(GROUPINGS).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="">
            <Checkbox
              id="show-inline-diff"
              checked={showInlineDiff}
              onCheckedChange={() => setShowInlineDiff(!showInlineDiff)}
              className="mr-1"
            />
            <label htmlFor="show-inline-diff">Show diff summaries</label>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow border-t border-gray-400 mt-4">
          {groupedChanges.map((changeGroup) => (
            <div
              className={`group px-1 py-2 w-full overflow-hidden cursor-default border-l-4 border-l-transparent  border-b border-gray-400 ${
                selectedChangeId === changeGroup.id
                  ? "bg-blue-100"
                  : groupedChanges.map((c) => c.id).indexOf(selectedChangeId) >
                    groupedChanges.map((c) => c.id).indexOf(changeGroup.id)
                  ? "opacity-50"
                  : ""
              }`}
              data-id={changeGroup.id}
              key={changeGroup.id}
              onClick={() => setSelectedChangeId(changeGroup.id)}
            >
              <div className="flex justify-between text-xs">
                <div>
                  <span className="text-green-600 font-bold mr-2">
                    +{changeGroup.charsAdded}
                  </span>
                  <span className="text-red-600 font-bold">
                    -{changeGroup.charsDeleted}
                  </span>
                </div>
                <div className="text-xs text-gray-600 text-right font-semibold">
                  <Hash key={changeGroup.id} hash={changeGroup.id} />
                </div>
              </div>
              <div className="text-xs text-gray-600 font-semibold">
                Actor
                {changeGroup.actorIds.map((id) => (
                  <Hash key={id} hash={id} />
                ))}
              </div>
              {showInlineDiff && (
                <div className="mt-4 ">
                  {changeGroup.diff.map((patch) => (
                    <div className="mb-1">
                      {patch.path[0] === "content" &&
                        patch.action === "splice" && (
                          <div className="text-green-900 bg-green-50 border border-green-700 p-1 rounded-md">
                            {truncate(patch.value, {
                              length: 100,
                            })}
                          </div>
                        )}

                      {patch.path[0] === "content" &&
                        patch.action === "del" && (
                          <div className="text-red-900 bg-red-50 border border-red-700 p-1 rounded-md">
                            Deleted {patch.length ?? 1} characters
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="p-2 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono flex">
          <div className="mr-4">Heads: {headsForDisplay}</div>
          <div className="flex">
            <Checkbox
              id="show-diff-overlay"
              className="mr-1"
              checked={showDiffOverlay}
              onCheckedChange={() => setShowDiffOverlay(!showDiffOverlay)}
            >
              Diff Overlay
            </Checkbox>
            <label htmlFor="show-diff-overlay" className="mr-4">
              Show Diff
            </label>
          </div>
        </div>
        <TinyEssayEditor
          docUrl={docUrl}
          key={docUrl}
          readOnly
          docHeads={docHeads}
          diffHeads={showDiffOverlay ? diffHeads : undefined}
        />
      </div>
    </div>
  );
};
