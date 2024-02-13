import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChangeGroup, HeadsMarker, getGroupedChanges } from "../groupChanges";

import {
  CalendarIcon,
  MergeIcon,
  MilestoneIcon,
  TrashIcon,
} from "lucide-react";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import { DiffWithProvenance } from "../schema";
import { useCurrentAccount } from "@/DocExplorer/account";

type MilestoneSelection = {
  type: "milestone";
  heads: Heads;
};

// the data structure that represents the range of change groups we've selected for showing diffs.
type ChangeGroupSelection = {
  type: "changeGroups";
  /** The older (causally) change group in the selection */
  from: ChangeGroup["id"];

  /** The newer (causally) change group in the selection */
  to: ChangeGroup["id"];
};

type Selection = MilestoneSelection | ChangeGroupSelection;

export const BasicHistoryLog: React.FC<{
  docUrl: AutomergeUrl;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
}> = ({ docUrl, setDocHeads, setDiff }) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const account = useCurrentAccount();

  // The grouping function returns change groups starting from the latest change.
  const { groupedChanges } = useMemo(() => {
    if (!doc) return { groupedChanges: [], changeCount: 0 };

    let markers: HeadsMarker[] = [];

    markers = markers.concat(
      (doc.tags ?? []).map((tag) => ({ heads: tag.heads, type: "tag", tag }))
    );
    markers = markers.concat(
      doc.branchMetadata.branches
        .filter((branch) => branch.mergeMetadata !== undefined)
        .map((branch) => ({
          heads: branch.mergeMetadata!.mergeHeads,
          type: "mergedBranch",
          branch,
        }))
    );
    const { changeCount, changeGroups } = getGroupedChanges(doc, {
      algorithm: "ByAuthor",
      numericParameter: 100,
      markers,
    });

    return {
      changeCount,
      groupedChanges: changeGroups,
    };
  }, [doc]);

  const [selection, setSelection] = useState<Selection | null>();

  const selectedChangeGroups: ChangeGroup[] = useMemo(() => {
    if (selection && selection.type === "changeGroups") {
      const fromIndex = groupedChanges.findIndex(
        (changeGroup) => changeGroup.id === selection.from
      );
      const toIndex = groupedChanges.findIndex(
        (changeGroup) => changeGroup.id === selection.to
      );
      return groupedChanges.slice(fromIndex, toIndex + 1);
    } else {
      return [];
    }
  }, [selection, groupedChanges]);

  // TODO: is the heads for a group always the id of the group?
  // for now it works because the id of the group is the last change in the group...
  const docHeads = useMemo(() => {
    if (!selection) return [];
    switch (selection.type) {
      case "milestone":
        return selection.heads;
      case "changeGroups":
        return [selection.to];
    }
  }, [selection]);

  // sync the diff and docHeads up to the parent component when the selection changes
  useEffect(() => {
    if (selection?.type === "changeGroups") {
      const diff = {
        fromHeads: selectedChangeGroups[0]?.diff.fromHeads,
        toHeads:
          selectedChangeGroups[selectedChangeGroups.length - 1]?.diff.toHeads,
        patches: selectedChangeGroups.flatMap((cg) => cg.diff.patches),
      };
      setDiff(diff);
      setDocHeads(docHeads);
    } else if (selection?.type === "milestone") {
      setDocHeads(selection.heads);
      setDiff({
        patches: [],
        fromHeads: selection.heads,
        toHeads: selection.heads,
      });
    } else {
      setDocHeads(undefined);
      setDiff(undefined);
    }
  }, [selectedChangeGroups, setDiff, setDocHeads, docHeads]);

  const handleClickOnChangeGroup = (
    e: React.MouseEvent,
    changeGroup: ChangeGroup
  ) => {
    // For normal clicks without the shift key, we just select one change.
    if (!e.shiftKey) {
      setSelection({
        type: "changeGroups",
        from: changeGroup.id,
        to: changeGroup.id,
      });
      return;
    }

    // If the shift key is pressed, we create a multi-change selection.
    // If there's no existing change group selected, just use the latest as the starting point for the selection.
    if (!selection || selection.type === "milestone") {
      setSelection({
        type: "changeGroups",
        from: changeGroup.id,
        to: groupedChanges[groupedChanges.length - 1].id,
      });
      return;
    }

    // Extend the existing range selection appropriately

    const indexOfSelectionFrom =
      selection.type === "changeGroups"
        ? groupedChanges.findIndex((c) => c.id === selection.from)
        : -1;

    const indexOfSelectionTo =
      selection.type === "changeGroups"
        ? groupedChanges.findIndex((c) => c.id === selection.to)
        : -1;

    const indexOfClickedChangeGroup = groupedChanges.findIndex(
      (c) => c.id === changeGroup.id
    );

    if (indexOfClickedChangeGroup < indexOfSelectionFrom) {
      setSelection({
        type: "changeGroups",
        from: changeGroup.id,
        to: selection.to,
      });
      return;
    }

    if (indexOfClickedChangeGroup > indexOfSelectionTo) {
      setSelection({
        type: "changeGroups",
        from: selection.from,
        to: changeGroup.id,
      });
      return;
    }

    setSelection({
      type: "changeGroups",
      from: selection.from,
      to: changeGroup.id,
    });
  };

  // When the user selects a heads in the history,
  // some change groups get "hiddden", meaning the contents of the group
  // aren't visible in the displayed doc.
  const headIsVisible = (head: string) => {
    if (!selection) return true;
    const lastVisibleChangeGroupId =
      selection.type === "changeGroups"
        ? selection.to
        : groupedChanges.find((cg) => cg.id === selection.heads[0]).id;
    return (
      groupedChanges.map((c) => c.id).indexOf(lastVisibleChangeGroupId) >=
      groupedChanges.map((c) => c.id).indexOf(head)
    );
  };

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollRef.current]);

  return (
    <div className="h-full w-72 border-r border-gray-200 overflow-y-hidden flex flex-col text-xs font-semibold text-gray-600">
      <div
        ref={scrollRef}
        className="overflow-y-auto pt-3 flex-grow flex flex-col"
      >
        {/* It's easiest to think of the change group in causal order, and we just reverse it on display
          in order to get most recent stuff at the top. */}
        {groupedChanges.map((changeGroup, index) => (
          <div className="relative" key={changeGroup.id}>
            {new Date(changeGroup.time).toDateString() !==
              new Date(groupedChanges[index - 1]?.time).toDateString() && (
              <div className="text-xs text-gray-700 font-semibold mt-2 mb-2 flex items-center border-b border-gray-400 p-1">
                <CalendarIcon size={14} className="mr-1" />
                {changeGroup.time &&
                  new Date(changeGroup.time).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    weekday: "long",
                  })}
                {!changeGroup.time && "Unknown time"}
              </div>
            )}

            <div
              className={`group px-1 py-3 w-full overflow-y-hidden cursor-default border-l-4 border-l-transparent select-none border-b border-gray-200 ${
                selectedChangeGroups.includes(changeGroup)
                  ? "bg-blue-100"
                  : headIsVisible(changeGroup.id)
                  ? ""
                  : "opacity-50"
              }`}
              data-id={changeGroup.id}
              key={changeGroup.id}
              onClick={(e) => {
                handleClickOnChangeGroup(e, changeGroup);
              }}
            >
              <div className="text-sm">
                {changeGroup.authorUrls.length > 0 && (
                  <div className=" text-gray-600 inline">
                    {changeGroup.authorUrls.map((contactUrl) => (
                      <InlineContactAvatar
                        key={contactUrl}
                        url={contactUrl}
                        size="sm"
                      />
                    ))}
                  </div>
                )}{" "}
                {changeGroup.editCount > 0 && (
                  <div className="inline font-normal">
                    made{" "}
                    {changeGroup.editCount === 1 ? "an" : changeGroup.editCount}{" "}
                    edit
                    {changeGroup.editCount > 1 ? "s" : ""}
                  </div>
                )}
                {changeGroup.editCount > 0 && changeGroup.commentsAdded > 0 && (
                  <div className="inline font-normal"> and </div>
                )}
                <div className="inline font-normal">
                  {changeGroup.commentsAdded > 0
                    ? `added ${changeGroup.commentsAdded} comment${
                        changeGroup.commentsAdded > 1 ? "s" : ""
                      }`
                    : ""}
                </div>
              </div>

              <div className="mt-1 font-bold flex">
                <span
                  className={`text-green-600  mr-2 ${
                    changeGroup.charsAdded === 0 && "opacity-50"
                  }`}
                >
                  +{changeGroup.charsAdded}
                </span>
                <span
                  className={`text-red-600 mr-2 ${
                    !changeGroup.charsDeleted && "opacity-50"
                  }`}
                >
                  -{changeGroup.charsDeleted || 0}
                </span>
                <span
                  className={`text-gray-500 ${
                    changeGroup.commentsAdded === 0 && "opacity-50"
                  }`}
                >
                  💬{changeGroup.commentsAdded}
                </span>
                {changeGroup.time && (
                  <div className=" font-normal text-gray-500 mb-2 text-xs ml-auto mr-3">
                    {new Date(changeGroup.time).toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "numeric",
                      hour12: true,
                    })}
                  </div>
                )}
              </div>
            </div>
            {selection?.type === "changeGroups" &&
              selection.to === changeGroup.id &&
              changeGroup.markers.length === 0 &&
              index !== 0 && (
                <div
                  className="absolute bottom-[-10px] left-4 bg-white border border-gray-300 px-1 cursor-pointer hover:bg-gray-50 text-xs"
                  onClick={() => {
                    changeDoc((doc) => {
                      if (!doc.tags) {
                        doc.tags = [];
                      }
                      doc.tags.push({
                        name: window.prompt("Tag name:"),
                        heads: [changeGroup.id],
                        createdAt: Date.now(),
                        createdBy: account?.contactHandle?.url,
                      });
                    });
                  }}
                >
                  <MilestoneIcon size={12} className="inline-block mr-1" />
                  Save milestone
                </div>
              )}
            {changeGroup.markers.map((marker) => (
              <div
                className={`text-xs text-gray-500 p-2 border-b border-gray-200 select-none ${
                  selection?.type === "milestone" &&
                  selection?.heads === marker.heads
                    ? "bg-blue-100"
                    : "bg-white hover:bg-gray-50"
                } ${headIsVisible(marker.heads[0]) ? "" : "opacity-50"}`}
                onClick={() => {
                  setSelection({
                    type: "milestone",
                    heads: marker.heads,
                  });
                }}
              >
                {marker.type === "tag" && (
                  <div>
                    <div>
                      <div className="text-sm">
                        {marker.tag.createdBy && (
                          <div className=" text-gray-600 inline">
                            <InlineContactAvatar
                              key={marker.tag.createdBy}
                              url={marker.tag.createdBy}
                              size="sm"
                            />
                          </div>
                        )}{" "}
                        <div className="inline font-normal">
                          marked milestone
                        </div>{" "}
                        <div className="inline font-semibold">
                          {marker.tag.name}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {marker.type === "mergedBranch" && (
                  <div>
                    <div className="text-sm">
                      {marker.branch.mergeMetadata!.mergedBy && (
                        <div className=" text-gray-600 inline">
                          <InlineContactAvatar
                            key={marker.branch.mergeMetadata!.mergedBy}
                            url={marker.branch.mergeMetadata!.mergedBy}
                            size="sm"
                          />
                        </div>
                      )}{" "}
                      <div className="inline font-normal">merged branch</div>{" "}
                      <div className="inline font-semibold">
                        {marker.branch.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
