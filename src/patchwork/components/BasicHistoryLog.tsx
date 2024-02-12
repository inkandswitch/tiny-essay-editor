import { DiffWithProvenance, MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChangeGroup, getGroupedChanges } from "../groupChanges";

import { CalendarIcon, MilestoneIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";

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

  // The grouping function returns change groups starting from the latest change.
  const { groupedChanges } = useMemo(() => {
    if (!doc) return { groupedChanges: [], changeCount: 0 };
    const branchTags = doc.branchMetadata.branches
      .filter((b) => b.mergeMetadata)
      .map((branch) => ({
        name: `merged ${branch.name}`,
        heads: branch.mergeMetadata.mergeHeads,
        createdAt: branch.mergeMetadata.mergedAt,
        createdBy: branch.mergeMetadata.mergedBy,
      }));
    const { changeCount, changeGroups } = getGroupedChanges(doc, {
      algorithm: "ByAuthor",
      numericParameter: 100,
      tags: [...(doc.tags ?? []), ...branchTags],
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
              className={`group px-1 py-3 w-full overflow-y-hidden cursor-default border-l-4 border-l-transparent select-none ${
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
                <div className="inline font-normal">
                  made {changeGroup.diff.patches.length} edits
                  {changeGroup.commentsAdded > 0
                    ? ` and added ${changeGroup.commentsAdded} comment${
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
              changeGroup.tags.length === 0 &&
              index !== 0 && (
                <div
                  className="absolute bottom-[-10px] left-4 bg-white rounded-sm border border-gray-300 px-1 cursor-pointer hover:bg-gray-50 text-xs"
                  onClick={() => {
                    changeDoc((doc) => {
                      if (!doc.tags) {
                        doc.tags = [];
                      }
                      doc.tags.push({
                        name: window.prompt("Tag name:"),
                        heads: [changeGroup.id],
                        createdAt: Date.now(),
                      });
                    });
                  }}
                >
                  <MilestoneIcon size={12} className="inline-block mr-1" />
                  Save milestone
                </div>
              )}
            {changeGroup.tags.map((tag) => (
              <div>
                <div
                  className={`text-xs text-gray-500  py-1 px-2 border-t border-b border-gray-300 select-none ${
                    selection?.type === "milestone" &&
                    selection?.heads === tag.heads
                      ? "bg-blue-100"
                      : "bg-gray-50 hover:bg-gray-100"
                  } ${headIsVisible(tag.heads[0]) ? "" : "opacity-50"}`}
                  onClick={() => {
                    setSelection({
                      type: "milestone",
                      heads: tag.heads,
                    });
                  }}
                >
                  <div className="flex items-center text-gray-800 text-sm">
                    <MilestoneIcon size={16} className="mr-1 mt-[2px]" />
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
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
