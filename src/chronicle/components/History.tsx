import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import {
  ChangeGroup,
  GROUPINGS_THAT_TAKE_BATCH_SIZE,
  GROUPINGS_THAT_TAKE_GAP_TIME,
  charsAddedAndDeletedByPatches,
  getGroupedChanges,
  groupPatchesByParagraph,
} from "../groupChanges";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { GROUPINGS } from "../groupChanges";
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
  EyeIcon,
  FileDiffIcon,
  TagIcon,
  TimerResetIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HorizontalMinimap, MinimapWithDiff } from "./MinimapWithDiff";
import { view } from "@automerge/automerge";
import { getRelativeTimeString } from "@/docExplorer/utils";
import { ContactAvatar } from "@/docExplorer/components/ContactAvatar";
import { CircularPacking } from "./CircularPacking";
import { hashToColor } from "../utils";
import { ReadonlySnippetView } from "@/tee/components/ReadonlySnippetView";

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

type ChangeGroupFields = (typeof changeGroupFields)[number];

type VisibleFieldsOnChangeGroup = { [key in ChangeGroupFields]: boolean };

type MainPaneView = "wholeDoc" | "snippets";

export const HistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // diffs can be shown either in the change log or in the doc itself.
  const [showDiffInDoc, setShowDiffInDoc] = useState<boolean>(true);

  const [visibleFieldsOnChangeGroup, setVisibleFieldsOnChangeGroup] =
    useState<VisibleFieldsOnChangeGroup>({
      editStats: false,
      actorIds: false,
      authors: true,
      time: true,
      diff: false,
      blobs: false,
      minimapVertical: false,
      minibar: true,
      sections: false,
    });

  // The grouping algorithm to use for the change log (because this is a playground!)
  const [activeGroupingAlgorithm, setActiveGroupingAlgorithm] =
    useState<keyof typeof GROUPINGS>("ByAuthor");

  // The view mode for the main pane (either "wholeDoc" or "snippets")
  const [mainPaneView, setMainPaneView] = useState<MainPaneView>("wholeDoc");

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

  // the diff for the selected change groups
  const selectedDiff = selectedChangeGroups.flatMap((cg) => cg.diff);

  // the document state at the end of the selected change groups
  const selectedDoc = docHeads ? view(doc, docHeads) : doc;

  const diffGroupedByParagraph = useMemo(
    () => groupPatchesByParagraph(selectedDoc, selectedDiff),
    [selectedDoc, selectedDiff]
  );

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
            History
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
          </div>

          <div className="flex items-center mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  aria-label="Change visible fields"
                >
                  <EyeIcon size={14} />
                  Set visible fields
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {changeGroupFields.map((field) => (
                  <DropdownMenuItem
                    key={field}
                    className="flex items-center"
                    onClick={() => {
                      setVisibleFieldsOnChangeGroup((visibleFields) => ({
                        ...visibleFields,
                        [field]: !visibleFields[field],
                      }));
                    }}
                  >
                    <Checkbox
                      id={`change-group-field-${field}`}
                      className="mr-1"
                      checked={visibleFieldsOnChangeGroup[field]}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        setVisibleFieldsOnChangeGroup((visibleFields) => ({
                          ...visibleFields,
                          [field]: !visibleFields[field],
                        }))
                      }
                    />
                    <label htmlFor={`change-group-field-${field}`}>
                      {field}
                    </label>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                  <div className="flex justify-between text-xs mb-2">
                    {visibleFieldsOnChangeGroup.authors &&
                      changeGroup.authorUrls.length > 0 && (
                        <div className="text-sm text-gray-600  mb-2">
                          <div className="text-gray-500 uppercase text-xs font-bold">
                            Authors
                          </div>
                          {changeGroup.authorUrls.map((contactUrl) => (
                            <ContactAvatar
                              key={contactUrl}
                              url={contactUrl}
                              showName={true}
                              size="sm"
                            />
                          ))}
                        </div>
                      )}

                    <div className="text-xs text-gray-600 text-right font-semibold">
                      <Hash key={changeGroup.id} hash={changeGroup.id} />
                    </div>
                  </div>
                  {visibleFieldsOnChangeGroup.actorIds && (
                    <div className="text-xs text-gray-600 font-semibold mb-2">
                      <div className="text-gray-500 font-bold uppercase">
                        Actors
                      </div>
                      {changeGroup.actorIds.map((id) => (
                        <Hash key={id} hash={id} />
                      ))}
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.diff && (
                    <div className="mb-2">
                      <div className="text-gray-500 font-bold uppercase text-xs">
                        Diff
                      </div>
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
                  {visibleFieldsOnChangeGroup.time && changeGroup.time && (
                    <div className="text-gray-500 mb-2 text-sm">
                      <div className="text-gray-500 font-bold uppercase text-xs">
                        Last edited
                      </div>

                      {getRelativeTimeString(changeGroup.time)}
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.editStats && (
                    <div className="mb-2 font-bold">
                      <div className="inline">
                        <div className="text-gray-500 uppercase">Stats</div>
                        <span className="text-green-600  mr-2">
                          +{changeGroup.charsAdded}
                        </span>
                        <span className="text-red-600 ">
                          -{changeGroup.charsDeleted}
                        </span>
                      </div>
                      <div className="inline ml-2">
                        /{" "}
                        {
                          groupPatchesByParagraph(
                            changeGroup.docAtEndOfChangeGroup,
                            changeGroup.diff
                          ).length
                        }{" "}
                        paragraphs
                      </div>
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.blobs && (
                    <div className="text-xs text-gray-600 font-semibold mb-2">
                      <div className="text-gray-500 font-bold uppercase">
                        Blobs
                      </div>
                      <div
                        className={`w-48 min-h-8 h-[${BLOBS_HEIGHT}px] flex justify-center items-center border border-gray-200`}
                      >
                        <CircularPacking
                          data={{
                            type: "node",
                            name: "root",
                            value:
                              changeGroup.charsAdded + changeGroup.charsDeleted,
                            children: changeGroup.diff.map((patch) => ({
                              type: "leaf",
                              name: "",
                              value:
                                patch.action === "splice"
                                  ? patch.value.length
                                  : patch.action === "del"
                                  ? patch.length
                                  : 0,
                              color:
                                patch.action === "splice" ? "green" : "red",
                            })),
                          }}
                          width={100}
                          height={
                            BLOBS_HEIGHT *
                            Math.min(
                              1,
                              (changeGroup.charsAdded +
                                changeGroup.charsDeleted) /
                                // this constant here is a hack -- we're just trying to make the height
                                // of the blobs proportional to the number of characters in the
                                // change...
                                // maybe would be better to pick this number based on the max
                                // size of a change group in this doc's history?
                                // One important note is that if the change size exceeds this maximum, it's fine, it doesn't overflow.
                                // The problem is that if this constant is too big, smaller changes become invisibly tiny.
                                200
                            )
                          }
                        />
                      </div>
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.minimapVertical && (
                    <div className="mb-2">
                      <div className="text-gray-500 font-bold uppercase">
                        Minimap
                      </div>
                      <div>
                        <MinimapWithDiff
                          doc={changeGroup.docAtEndOfChangeGroup}
                          patches={changeGroup.diff}
                          size="compact"
                        />
                      </div>
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.minibar && (
                    <div className="mb-2">
                      <div className="text-gray-500 font-bold uppercase">
                        Minibar
                      </div>
                      <div>
                        <HorizontalMinimap
                          doc={changeGroup.docAtEndOfChangeGroup}
                          patches={changeGroup.diff}
                        />
                      </div>
                    </div>
                  )}
                  {visibleFieldsOnChangeGroup.sections && (
                    <div className="text-gray-500 mb-2 text-sm">
                      <div className="text-gray-500 font-bold uppercase text-xs">
                        Sections
                      </div>

                      {changeGroup.headings.filter((h) => h.patches.length > 0)
                        .length > 0 && (
                        <ul>
                          {changeGroup.headings
                            .filter((h) => h.patches.length > 0)
                            .map((heading) => {
                              const { charsAdded, charsDeleted } =
                                charsAddedAndDeletedByPatches(heading.patches);
                              return (
                                <li className="text-xs">
                                  ## {truncate(heading.text, { length: 20 })}{" "}
                                  {charsAdded > 0 && (
                                    <span className="text-green-600  mr-2">
                                      +{charsAdded}
                                    </span>
                                  )}
                                  {charsDeleted > 0 && (
                                    <span className="text-red-600 ">
                                      -{charsDeleted}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                        </ul>
                      )}
                      {changeGroup.headings.filter((h) => h.patches.length > 0)
                        .length === 0 && (
                        <div className="text-xs text-gray-400 italic">
                          No edited sections
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
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
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6 mt-[-4px] font-semibold ml-auto"
                onClick={() => setChangeGroupSelection(null)}
              >
                <TimerResetIcon size={12} className="mr-1 inline" />
                Reset view to latest
              </Button>
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
              diffHeads={showDiffInDoc ? diffHeads : undefined}
            />
            {doc && changeGroupSelection && showDiffInDoc && (
              <div className="absolute top-20 right-6">
                <MinimapWithDiff doc={selectedDoc} patches={selectedDiff} />
              </div>
            )}
          </>
        )}
        {mainPaneView === "snippets" && docUrl && (
          <div className="h-full overflow-y-auto bg-gray-50">
            {diffGroupedByParagraph.map((snippet) => (
              <div
                className="bg-white border border-gray-300 m-4 max-w-[722px]"
                key={JSON.stringify(snippet.patches)}
              >
                <ReadonlySnippetView
                  text={selectedDoc.content.slice(
                    snippet.groupStartIndex,
                    snippet.groupEndIndex
                  )}
                  patches={snippet.patches}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
