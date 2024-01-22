import { Slider } from "@/components/ui/slider";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDiffIcon } from "lucide-react";
import {
  ChangeGroup,
  GROUPINGS,
  GROUPINGS_THAT_TAKE_BATCH_SIZE,
  GROUPINGS_THAT_TAKE_GAP_TIME,
  getGroupedChanges,
} from "../groupChanges";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { view } from "@automerge/automerge";
import { CopyIcon } from "lucide-react";
import { hashToColor } from "../utils";
import { next as A } from "@automerge/automerge";
import { MinimapWithDiff } from "./MinimapWithDiff";

const BLOBS_HEIGHT = 70;

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

// the data structure that represents the range of change groups we've selected for showing diffs.
type ChangeGroupSelection = {
  /** The older (causally) change group in the selection */
  from: ChangeGroup["id"];

  /** The newer (causally) change group in the selection */
  to: ChangeGroup["id"];
};

const changeGroupFields = [
  "authors",
  "actorIds",
  "diff",
  "time",
  "editStats",
  "blobs",
  "minimapVertical",
  "minibar",
  "sections",
] as const;

type MainPaneView = "wholeDoc" | "snippets";

export const RewindPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  // The grouping algorithm to use for the change log (because this is a playground!)
  const [activeGroupingAlgorithm, setActiveGroupingAlgorithm] =
    useState<keyof typeof GROUPINGS>("ByEditTime");

  // Some grouping algorithms have a batch size parameter.
  // we can set this using a slider in the UI.
  const [groupingNumericParameter, setGroupingNumericParameter] =
    useState<number>(60);

  // The grouping function returns change groups starting from the latest change.
  const { groupedChanges, changeCount } = useMemo(() => {
    if (!doc) return { groupedChanges: [], changeCount: 0 };
    const { changeCount, changeGroups } = getGroupedChanges(doc, {
      algorithm: activeGroupingAlgorithm,
      numericParameter: groupingNumericParameter,
      tags: doc.tags ?? [],
    });

    return {
      changeCount,
      groupedChanges: changeGroups,
    };
  }, [doc, activeGroupingAlgorithm, groupingNumericParameter]);

  // When the algorithm or batch size changes, the selection can get weird.
  // just reset whenever either of those changes.
  useEffect(() => {
    setChangeGroupSelection(null);
  }, [activeGroupingAlgorithm, groupingNumericParameter]);

  const [changeGroupSelection, setChangeGroupSelection] =
    useState<ChangeGroupSelection | null>();

  let selectedChangeGroups: ChangeGroup[] = [];
  if (changeGroupSelection) {
    const fromIndex = groupedChanges.findIndex(
      (changeGroup) => changeGroup.id === changeGroupSelection.from
    );
    const toIndex = groupedChanges.findIndex(
      (changeGroup) => changeGroup.id === changeGroupSelection.to
    );
    selectedChangeGroups = groupedChanges.slice(fromIndex, toIndex + 1);
  }

  // TODO: is the heads for a group always the id of the group?
  // for now it works because the id of the group is the last change in the group...
  const docHeads = changeGroupSelection ? [changeGroupSelection.to] : undefined;

  let diffHeads = docHeads;
  if (changeGroupSelection) {
    const indexOfDiffFrom = groupedChanges
      .map((c) => c.id)
      .indexOf(changeGroupSelection.from);
    if (indexOfDiffFrom > 0) {
      diffHeads = [groupedChanges[indexOfDiffFrom - 1].id];
    } else {
      diffHeads = [];
    }
  }

  // the diff for the selected change groups
  const selectedDiff = selectedChangeGroups.flatMap((cg) => cg.diff);

  // state for rewind slider
  const [rewoundSteps, setRewoundSteps] = useState<number>(0);

  const selectedChangeGroupIndex = Math.max(
    0,
    groupedChanges.length - rewoundSteps
  );

  const onChangeRewindSlider = (value: number) => {
    setRewoundSteps(groupedChanges.length - value);
  };

  const patches = useMemo(() => {
    const selectedChangeGroup = groupedChanges[selectedChangeGroupIndex];

    if (!selectedChangeGroup) {
      return [];
    }

    const docBefore = selectedChangeGroup.docAtEndOfChangeGroup;
    return A.diff(doc, A.getHeads(doc), A.getHeads(docBefore));
  }, [selectedChangeGroupIndex, groupedChanges, doc]);

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-y-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="p-1">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Changes
          </div>

          <div className="mb-2">
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

            <div className="h-4 mb-2">
              {GROUPINGS_THAT_TAKE_BATCH_SIZE.includes(
                activeGroupingAlgorithm
              ) && (
                <div className="flex">
                  <div className="text-xs mr-2 w-40">Batch size</div>
                  <Slider
                    defaultValue={[groupingNumericParameter]}
                    min={1}
                    max={changeCount}
                    step={1}
                    onValueChange={(value) =>
                      setGroupingNumericParameter(value[0])
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    max={changeCount}
                    value={groupingNumericParameter}
                    onChange={(e) =>
                      setGroupingNumericParameter(parseInt(e.target.value))
                    }
                  />
                </div>
              )}
              {GROUPINGS_THAT_TAKE_GAP_TIME.includes(
                activeGroupingAlgorithm
              ) && (
                <div className="flex">
                  <div className="text-xs mr-2 w-36">Max gap (m)</div>
                  <Slider
                    defaultValue={[groupingNumericParameter]}
                    max={1000}
                    min={1}
                    step={1}
                    onValueChange={(value) =>
                      setGroupingNumericParameter(value[0])
                    }
                    className="w-48"
                  />
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={groupingNumericParameter}
                    onChange={(e) =>
                      setGroupingNumericParameter(parseInt(e.target.value))
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="h-8 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono flex items-center px-2 gap-4">
          <div className="flex flex-1">
            <label htmlFor="rewind-slider" className="mr-4">
              Revision ({selectedChangeGroupIndex}/{groupedChanges.length}):
            </label>

            <Slider
              id="rewind-slider"
              max={groupedChanges.length}
              min={0}
              value={[selectedChangeGroupIndex]}
              step={1}
              onValueChange={(value) => onChangeRewindSlider(value[0])}
              className="flex-1"
            />
          </div>
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
            key={docUrl}
            readOnly={docHeads !== undefined}
            docHeads={docHeads}
            diff={[]}
          />
        )}
        {false &&
          doc &&
          changeGroupSelection &&
          showDiffInDoc && ( // disable for now
            <div className="absolute top-20 right-6">
              <MinimapWithDiff doc={doc} patches={[]} />
            </div>
          )}
      </div>
    </div>
  );
};
