import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useMemo } from "react";
import { getGroupedChanges } from "../utils";

export const Changelog: React.FC<{ docUrl: AutomergeUrl }> = ({ docUrl }) => {
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const groupedChanges = useMemo(() => {
    if (!doc) return [];
    return getGroupedChanges(doc);
  }, [doc]);

  return (
    <div>
      <div className="p-1 text-xs text-gray-500">Changelog</div>
      <div>
        {groupedChanges.map((changeGroup) => (
          <div
            className="group px-1 py-2 w-full overflow-hidden cursor-default border-l-4 border-l-transparent  border-b border-gray-200"
            data-id={changeGroup.id}
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
              <div className="text-xs text-gray-400 text-right">
                {changeGroup.changes[0].hash.substring(0, 6)}
              </div>
            </div>
            <div>
              Actor IDs:{" "}
              {changeGroup.actorIds.map((id) => id.substring(0, 6)).join(", ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
