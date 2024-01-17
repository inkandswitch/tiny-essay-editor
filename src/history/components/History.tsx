import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import {
  ChangeGroup,
  GROUPINGS_THAT_TAKE_BATCH_SIZE,
  GROUPINGS_THAT_TAKE_GAP_TIME,
  getGroupedChanges,
} from "../utils";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { GROUPINGS } from "../utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncate } from "lodash";
import {
  CopyIcon,
  FileDiffIcon,
  TagIcon,
  TimerResetIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MinimapWithDiff } from "./MinimapWithDiff";
import { view } from "@automerge/automerge";
import { getRelativeTimeString } from "@/DocExplorer/utils";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";

export const hashToColor = (hash: string) => {
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

export const HistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffSummariesInLog, setShowDiffSummariesInLog] =
    useState<boolean>(false);
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  // The grouping algorithm to use for the change log (because this is a playground!)
  const [activeGroupingAlgorithm, setActiveGroupingAlgorithm] =
    useState<keyof typeof GROUPINGS>("ByCharCount");

  // Some grouping algorithms have a batch size parameter.
  // we can set this using a slider in the UI.
  const [groupingNumericParameter, setGroupingNumericParameter] =
    useState<number>(1000);

  // The grouping function returns change groups starting from the latest change.
  const { changeGroups: groupedChanges, changeCount } = useMemo(() => {
    if (!doc) return { changeGroups: [], changeCount: 0 };
    return getGroupedChanges(doc, {
      algorithm: activeGroupingAlgorithm,
      numericParameter: groupingNumericParameter,
      tags: doc.tags ?? [],
    });
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

  const handleClickOnChangeGroup = (
    e: React.MouseEvent,
    changeGroup: ChangeGroup
  ) => {
    // For normal clicks without the shift key, we just select one change.
    if (!e.shiftKey) {
      setChangeGroupSelection({
        from: changeGroup.id,
        to: changeGroup.id,
      });
      return;
    }

    // If the shift key is pressed, we create a multi-change selection.
    // If there's no existing change group selected, just use the latest as the starting point for the selection.
    if (!changeGroupSelection) {
      setChangeGroupSelection({
        from: changeGroup.id,
        to: groupedChanges[groupedChanges.length - 1].id,
      });
      return;
    }

    // Extend the existing range selection appropriately

    const indexOfSelectionFrom = groupedChanges.findIndex(
      (c) => c.id === changeGroupSelection.from
    );

    const indexOfSelectionTo = groupedChanges.findIndex(
      (c) => c.id === changeGroupSelection.to
    );

    const indexOfClickedChangeGroup = groupedChanges.findIndex(
      (c) => c.id === changeGroup.id
    );

    if (indexOfClickedChangeGroup < indexOfSelectionFrom) {
      setChangeGroupSelection({
        from: changeGroup.id,
        to: changeGroupSelection.to,
      });
      return;
    }

    if (indexOfClickedChangeGroup > indexOfSelectionTo) {
      setChangeGroupSelection({
        from: changeGroupSelection.from,
        to: changeGroup.id,
      });
      return;
    }

    setChangeGroupSelection({
      from: changeGroupSelection.from,
      to: changeGroup.id,
    });
  };
  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-y-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="p-1">
          <div className="text-xs text-gray-500 uppercase font-bold mb-2">
            Change log
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
                  <div className="text-xs mr-2 w-36">Batch size</div>
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
                  <div className="text-xs mr-2 w-36">Max gap (s)</div>
                  <Slider
                    defaultValue={[groupingNumericParameter]}
                    max={300}
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
                    max={300}
                    value={groupingNumericParameter}
                    onChange={(e) =>
                      setGroupingNumericParameter(parseInt(e.target.value))
                    }
                  />
                </div>
              )}
            </div>
            <div>
              <Checkbox
                id="show-inline-diff"
                checked={showDiffSummariesInLog}
                onCheckedChange={() =>
                  setShowDiffSummariesInLog(!showDiffSummariesInLog)
                }
                className="mr-1"
              />
              <label htmlFor="show-inline-diff">Show diff summaries</label>
            </div>
          </div>

          <div className="h-4">
            {docHeads && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6"
                onClick={() => setChangeGroupSelection(null)}
              >
                <TimerResetIcon size={12} className="mr-1 inline" />
                Reset view to latest
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-grow border-t border-gray-400 pt-4 mt-2">
          {/* It's easiest to think of the change group in causal order, and we just reverse it on display
          in order to get most recent stuff at the top. */}
          {groupedChanges
            .slice()
            .reverse()
            .map((changeGroup) => (
              <div className="relative">
                {changeGroupSelection?.to === changeGroup.id &&
                  changeGroup.tags.length === 0 && (
                    <div
                      className="absolute top-[-10px] left-4 bg-white rounded-sm border border-gray-300 px-1 cursor-pointer hover:bg-gray-50 text-xs"
                      onClick={() => {
                        changeDoc((doc) => {
                          if (!doc.tags) {
                            doc.tags = [];
                          }
                          doc.tags.push({
                            name: window.prompt("Tag name:"),
                            heads: [changeGroup.id],
                          });
                        });
                      }}
                    >
                      <TagIcon size={12} className="inline-block mr-1" />
                      Add a tag
                    </div>
                  )}
                {changeGroup.tags.map((tag) => (
                  <div className="bg-gray-200 px-1 flex border border-gray-200 my-1 items-center text-gray-800">
                    <TagIcon size={12} className="mr-1 mt-[2px]" />
                    <div>{tag.name}</div>
                    <div className="ml-auto">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => {
                          changeDoc((doc) => {
                            const tagIndex = doc.tags.indexOf(tag);
                            doc.tags.splice(tagIndex, 1);
                          });
                        }}
                      >
                        <TrashIcon size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
                <div
                  className={`group px-1 py-3 w-full overflow-y-hidden cursor-default border-l-4 border-l-transparent  border-b border-gray-400 select-none ${
                    selectedChangeGroups.includes(changeGroup)
                      ? "bg-blue-100"
                      : changeGroupSelection &&
                        groupedChanges
                          .map((c) => c.id)
                          .indexOf(changeGroupSelection.to) <
                          groupedChanges
                            .map((c) => c.id)
                            .indexOf(changeGroup.id)
                      ? "opacity-50"
                      : ""
                  }`}
                  data-id={changeGroup.id}
                  key={changeGroup.id}
                  onClick={(e) => {
                    handleClickOnChangeGroup(e, changeGroup);
                  }}
                >
                  <div className="flex justify-between text-xs mb-1">
                    <div>
                      <div className="text-gray-500 font-bold uppercase">
                        Edits
                      </div>
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
                  <div className="text-xs text-gray-600 font-semibold mb-1">
                    <div className="text-gray-500 font-bold uppercase">
                      Actors
                    </div>
                    {changeGroup.actorIds.map((id) => (
                      <Hash key={id} hash={id} />
                    ))}
                  </div>
                  {changeGroup.authorUrls.length > 0 && (
                    <div className="text-xs text-gray-600 font-semibold mb-1">
                      <div className="text-gray-500 font-bold uppercase">
                        Authors
                      </div>
                      {changeGroup.authorUrls.map((contactUrl) => (
                        <ContactAvatar
                          url={contactUrl}
                          showName={true}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}
                  {showDiffSummariesInLog && (
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
                  {changeGroup.time && (
                    <div className="text-gray-500">
                      <div className="text-gray-500 font-bold uppercase">
                        Last edited
                      </div>

                      {getRelativeTimeString(changeGroup.time)}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div className="flex-grow overflow-hidden">
        <div className="p-2 h-8 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
          {docHeads && (
            <div className="flex">
              <div className="mr-6">
                Showing past state (readonly):{" "}
                {docHeads?.map((head) => <Hash key={head} hash={head} />) ||
                  "latest"}
              </div>
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
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 mt-[-4px]"
                onClick={() => setChangeGroupSelection(null)}
              >
                <TimerResetIcon size={12} className="mr-1 inline" />
                Reset view to latest
              </Button>
            </div>
          )}
          {!docHeads && <div>Showing current state (editable)</div>}
        </div>

        <TinyEssayEditor
          docUrl={docUrl}
          key={docUrl}
          readOnly={docHeads !== undefined}
          docHeads={docHeads}
          diffHeads={showDiffInDoc ? diffHeads : undefined}
        />
        {doc && changeGroupSelection && showDiffInDoc && (
          <div className="absolute top-20 right-6">
            <MinimapWithDiff
              doc={docHeads ? view(doc, docHeads) : doc}
              patches={selectedChangeGroups.flatMap((cg) => cg.diff)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
