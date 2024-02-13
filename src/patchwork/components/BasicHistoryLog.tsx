import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChangeGroup,
  getGroupedChanges,
  getMarkersForDoc,
} from "../groupChanges";

import { CalendarIcon, MilestoneIcon } from "lucide-react";
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
  const handle = useHandle<MarkdownDoc>(docUrl);
  const repo = useRepo();
  const account = useCurrentAccount();

  const markers = useMemo(
    () => getMarkersForDoc(handle, repo),
    [doc, handle, repo]
  );

  // The grouping function returns change groups starting from the latest change.
  const { groupedChanges } = useMemo(() => {
    if (!doc) return { groupedChanges: [], changeCount: 0 };

    const { changeCount, changeGroups } = getGroupedChanges(doc, {
      algorithm: "ByAuthor",
      numericParameter: 100,
      markers,
    });

    return {
      changeCount,
      groupedChanges: changeGroups,
    };
  }, [doc, markers]);

  /** If there's a marker that specifies "hide history before this", we
   *  collapse change groups before that point by default.
   */
  const lastHiddenChangeGroupIndex = markers.some(
    (m) => m.hideHistoryBeforeThis
  )
    ? /** TODO: in the case of multiple markers with the flag set;
       *  this logic will only hide before the first such marker;
       *  unclear if this is what we want? See how it works in real cases;
       *  we don't actually have a use case where it matters yet.
       */
      groupedChanges.findIndex((g) =>
        g.markers.some((m) => m.hideHistoryBeforeThis)
      )
    : -1;

  const [showHiddenChangeGroups, setShowHiddenChangeGroups] = useState(false);

  const [selection, setSelection] = useState<Selection | null>();

  // When the grouping changes, we diff back to the "history start point" if present.
  // This means that on a branch, when you open the history you'll see the diff from the branch point to the latest change.
  useEffect(() => {
    if (
      selection ||
      !groupedChanges.length ||
      lastHiddenChangeGroupIndex === -1
    )
      return;
    setSelection({
      type: "changeGroups",
      from: groupedChanges[lastHiddenChangeGroupIndex + 1].id,
      to: groupedChanges[groupedChanges.length - 1].id,
    });
  }, [groupedChanges, lastHiddenChangeGroupIndex, selection]);

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
        {lastHiddenChangeGroupIndex >= 0 && !showHiddenChangeGroups && (
          <div className="text-xs text-gray-500 pl-2 mb-2">
            {lastHiddenChangeGroupIndex} changes hidden
            <span
              className="text-gray-500 hover:text-gray-700 underline cursor-pointer ml-2"
              onClick={() => setShowHiddenChangeGroups(true)}
            >
              Show
            </span>
          </div>
        )}

        {groupedChanges.map((changeGroup, index) => {
          // GL note 2/13
          // The logic here is a bit weird because of how we associate markers and change groups.
          // Mostly, hiding groups is straightforward. We just don't show groups before the hidden index.
          // But at the boundary things get odd.
          // A marker is associated with the change group before it.
          // When we hide changes, we want to show the marker after the last hidden group, but we don't want to show the last hidden group.
          // This means that for the last hidden group, we hide the contents but show the marker.
          // It's possible that markers should live more on their own in the grouping list, or maybe even be associated with the group after them..?
          // But neither of those are obviously better than associating a marker with a group before, so we're sticking with this for now.

          const hideGroupEntirely =
            index < lastHiddenChangeGroupIndex && !showHiddenChangeGroups;

          const hideGroupButShowMarkers =
            index === lastHiddenChangeGroupIndex && !showHiddenChangeGroups;

          if (hideGroupEntirely) {
            return null;
          }
          return (
            <div key={changeGroup.id}>
              <div className="relative">
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

                {!hideGroupButShowMarkers && (
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
                          {changeGroup.editCount === 1
                            ? "an"
                            : changeGroup.editCount}{" "}
                          edit
                          {changeGroup.editCount > 1 ? "s" : ""}
                        </div>
                      )}
                      {changeGroup.editCount > 0 &&
                        changeGroup.commentsAdded > 0 && (
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
                )}
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
                {lastHiddenChangeGroupIndex === index &&
                  showHiddenChangeGroups && (
                    <div className="text-xs text-gray-500 pl-2 my-2">
                      <span
                        className="text-gray-500 hover:text-gray-700 underline cursor-pointer ml-2"
                        onClick={() => setShowHiddenChangeGroups(false)}
                      >
                        Hide changes before this
                      </span>
                    </div>
                  )}
                {changeGroup.markers.map((marker) => (
                  <div
                    key={marker.heads[0]}
                    className={`text-xs text-gray-500 p-2 mx-6 my-2 border border-yellow-300 shadow-md select-none ${
                      selection?.type === "milestone" &&
                      selection?.heads === marker.heads
                        ? "bg-yellow-200"
                        : "bg-yellow-50 hover:bg-yellow-200"
                    } ${headIsVisible(marker.heads[0]) ? "" : "opacity-50"} ${
                      parseInt(marker.heads[0], 58) % 2 === 0
                        ? "rotate-2"
                        : "-rotate-2"
                    }`}
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
                              marked a milestone:
                            </div>{" "}
                            <div className="inline font-semibold">
                              {marker.tag.name}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {marker.type === "otherBranchMergedIntoThisDoc" && (
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
                          <div className="inline font-normal">
                            merged a branch:
                          </div>{" "}
                          <div className="inline font-semibold">
                            {marker.branch.name}
                          </div>
                        </div>
                      </div>
                    )}
                    {marker.type === "originOfThisBranch" && (
                      <div>
                        <div className="text-sm">
                          {marker.branch.createdBy && (
                            <div className=" text-gray-600 inline">
                              <InlineContactAvatar
                                key={marker.branch.createdBy}
                                url={marker.branch.createdBy}
                                size="sm"
                              />
                            </div>
                          )}{" "}
                          <div className="inline font-normal">
                            started this branch:
                          </div>{" "}
                          <div className="inline font-semibold">
                            {marker.branch.name}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
