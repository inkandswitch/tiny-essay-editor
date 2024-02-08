import { DiffWithProvenance, MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useState } from "react";
import { ChangeGroup, getGroupedChanges } from "../groupChanges";

import {
  CalendarIcon,
  SaveIcon,
  TimerResetIcon,
  TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heads } from "@automerge/automerge/next";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";

// the data structure that represents the range of change groups we've selected for showing diffs.
type ChangeGroupSelection = {
  /** The older (causally) change group in the selection */
  from: ChangeGroup["id"];

  /** The newer (causally) change group in the selection */
  to: ChangeGroup["id"];
};

export const BasicHistoryLog: React.FC<{
  docUrl: AutomergeUrl;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
}> = ({ docUrl, setDocHeads, setDiff }) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);

  // The grouping function returns change groups starting from the latest change.
  const { groupedChanges } = useMemo(() => {
    if (!doc) return { groupedChanges: [], changeCount: 0 };
    const { changeCount, changeGroups } = getGroupedChanges(doc, {
      algorithm: "ByAuthor",
      numericParameter: 100,
      tags: doc.tags ?? [],
    });

    return {
      changeCount,
      groupedChanges: changeGroups,
    };
  }, [doc]);

  const changesForDisplay = groupedChanges.slice().reverse();

  const [changeGroupSelection, setChangeGroupSelection] =
    useState<ChangeGroupSelection | null>();

  const selectedChangeGroups: ChangeGroup[] = useMemo(() => {
    if (changeGroupSelection) {
      const fromIndex = groupedChanges.findIndex(
        (changeGroup) => changeGroup.id === changeGroupSelection.from
      );
      const toIndex = groupedChanges.findIndex(
        (changeGroup) => changeGroup.id === changeGroupSelection.to
      );
      return groupedChanges.slice(fromIndex, toIndex + 1);
    } else {
      return [];
    }
  }, [changeGroupSelection, groupedChanges]);

  // TODO: is the heads for a group always the id of the group?
  // for now it works because the id of the group is the last change in the group...
  const docHeads = useMemo(
    () => (changeGroupSelection ? [changeGroupSelection.to] : undefined),
    [changeGroupSelection]
  );

  // sync the diff and docHeads up to the parent component when the selection changes
  useEffect(() => {
    const diff = {
      fromHeads: selectedChangeGroups[0]?.diff.fromHeads,
      toHeads:
        selectedChangeGroups[selectedChangeGroups.length - 1]?.diff.toHeads,
      patches: selectedChangeGroups.flatMap((cg) => cg.diff.patches),
    };
    setDiff(diff);
    setDocHeads(docHeads);
  }, [selectedChangeGroups, setDiff, setDocHeads, docHeads]);

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
    <div className="w-72 border-r border-gray-200 overflow-y-hidden flex flex-col text-xs font-semibold text-gray-600 px-2">
      <div className="h-6 mb-1">
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

      <div className="overflow-y-auto flex-grow  pt-3">
        {/* It's easiest to think of the change group in causal order, and we just reverse it on display
          in order to get most recent stuff at the top. */}
        {changesForDisplay.map((changeGroup, index) => (
          <div className="relative" key={changeGroup.id}>
            {new Date(changeGroup.time).toDateString() !==
              new Date(changesForDisplay[index - 1]?.time).toDateString() && (
              <div className="text-sm text-gray-500 font-semibold mb-2 flex items-center bg-gray-100 border-b border-gray-300 p-1">
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
            {changeGroupSelection?.to === changeGroup.id &&
              changeGroup.tags.length === 0 &&
              index !== 0 && (
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
                        createdAt: Date.now(),
                      });
                    });
                  }}
                >
                  <SaveIcon size={12} className="inline-block mr-1" />
                  Save a snapshot here
                </div>
              )}
            {changeGroup.tags.map((tag) => (
              <div className="bg-yellow-50 p-1 px-2 flex border border-yellow-500 rounded-md my-1 items-center text-gray-800 text-sm">
                <SaveIcon size={16} className="mr-1 mt-[2px]" />
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
              className={`group px-1 py-3 w-full overflow-y-hidden cursor-default border-l-4 border-l-transparent select-none ${
                selectedChangeGroups.includes(changeGroup)
                  ? "bg-blue-100"
                  : changeGroupSelection &&
                    groupedChanges
                      .map((c) => c.id)
                      .indexOf(changeGroupSelection.to) <
                      groupedChanges.map((c) => c.id).indexOf(changeGroup.id)
                  ? "opacity-50"
                  : ""
              }`}
              data-id={changeGroup.id}
              key={changeGroup.id}
              onClick={(e) => {
                handleClickOnChangeGroup(e, changeGroup);
              }}
            >
              <div className="flex text-xs">
                {changeGroup.authorUrls.length > 0 && (
                  <div className="text-sm text-gray-600 ">
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
                {changeGroup.time && (
                  <div className=" font-normal text-gray-500 mb-2 text-sm ml-auto mr-3">
                    {new Date(changeGroup.time).toLocaleString("en-US", {
                      hour: "numeric",
                      minute: "numeric",
                      hour12: true,
                    })}
                  </div>
                )}
              </div>

              <div className="mb-2 font-bold">
                <div className="inline">
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
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
