import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useMemo, useState } from "react";
import { getGroupedChanges } from "../utils";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { GROUPINGS } from "../utils";

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

export const Changelog: React.FC<{ docUrl: AutomergeUrl }> = ({ docUrl }) => {
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const [selectedChangeId, setSelectedChangeId] = React.useState<
    string | null
  >();

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

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="w-64 border-r border-gray-200 overflow-hidden flex flex-col font-mono">
        <div className="p-1 text-xs text-gray-500 uppercase font-bold">
          Change log
        </div>
        <div className="flex justify-between p-1">
          <div className="flex">
            <div className="text-xs text-gray-500 uppercase font-bold mr-2">
              Group by
            </div>
            <select
              className="text-xs text-gray-500  font-bold"
              value={activeGroupingAlgorithm}
              onChange={(e) =>
                setActiveGroupingAlgorithm(e.target.value as any)
              }
            >
              {Object.keys(GROUPINGS).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-y-auto flex-grow">
          {groupedChanges.map((changeGroup) => (
            <div
              className={`group px-1 py-2 w-full overflow-hidden cursor-default border-l-4 border-l-transparent  border-b border-gray-200 ${
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
            </div>
          ))}
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="p-2 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
          <div className="inline-block mr-4">Heads: {headsForDisplay}</div>
          <div className="inline-block">Diff: Disabled</div>
        </div>
        <TinyEssayEditor
          docUrl={docUrl}
          key={docUrl}
          readOnly
          docHeads={docHeads}
        />
      </div>
    </div>
  );
};
