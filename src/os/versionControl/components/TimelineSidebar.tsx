import { AutomergeUrl } from "@automerge/automerge-repo";
import CodeMirror from "@uiw/react-codemirror";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useRef, ReactNode, useState } from "react";
import {
  TimelineItems,
  GenericChangeGroup,
  groupingByEditTime,
} from "../groupChanges";

import {
  MilestoneIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  CrownIcon,
  ChevronLeftIcon,
  PencilIcon,
  MoreVerticalIcon,
} from "lucide-react";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/os/explorer/components/InlineContactAvatar";
import {
  Branch,
  DiffWithProvenance,
  Discussion,
  HasChangeGroupSummaries,
  HasVersionControlMetadata,
  Tag,
} from "../schema";
import { useSlots } from "@/os/versionControl/utils";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscussionInput } from "./DiscussionInput";
import {
  populateChangeGroupSummaries,
  useAutoPopulateChangeGroupSummaries,
} from "@/os/versionControl/changeGroupSummaries";

import { DataType } from "@/os/datatypes";
import { ChangeGroupingOptions } from "../groupChanges";
import { ChangeGrouper } from "../ChangeGrouper";

const useScrollToBottom = (doc) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [scrollerRef.current, doc]);
  return scrollerRef;
};

/** A position for one side of a changelog selection */
type ChangelogSelectionAnchor = {
  /* The itemId of the anchor */
  itemId: string;

  /* The index of the anchor */
  index: number;

  /* The pixel position of the anchor */
  yPos: number;
};

const useTimelineItems = (
  handle,
  options: Omit<
    ChangeGroupingOptions<HasVersionControlMetadata<unknown, unknown>>,
    "markers"
  >
) => {
  const repo = useRepo();
  const [items, setItems] = useState<
    TimelineItems<HasVersionControlMetadata<unknown, unknown>>[]
  >([]);
  useEffect(() => {
    const grouper = new ChangeGrouper(handle, repo, options);
    if (grouper.items) {
      setItems(grouper.items);
    }

    const listener = (items) => {
      setItems(items);
    };

    grouper.on("change", listener);
    return () => {
      grouper.off("change", listener);
      grouper.teardown();
    };
  }, [handle, options]);
  return items;
};

export type ChangelogSelection =
  | { from: ChangelogSelectionAnchor; to: ChangelogSelectionAnchor }
  | undefined;

export const TimelineSidebar: React.FC<{
  dataType: DataType<unknown, unknown, unknown>;
  docUrl: AutomergeUrl;
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
}> = ({
  dataType,
  docUrl,
  selectedBranch,
  setSelectedBranch,
  setDocHeads,
  setDiff,
}) => {
  const [doc, changeDoc] =
    useDocument<HasVersionControlMetadata<unknown, unknown>>(docUrl);
  const [mainDoc] = useDocument<HasVersionControlMetadata<unknown, unknown>>(
    doc?.branchMetadata?.source?.url
  );
  const handle = useHandle<HasVersionControlMetadata<unknown, unknown>>(docUrl);
  const scrollerRef = useScrollToBottom(doc);
  const [showHiddenItems, setShowHiddenItems] = useState(false);

  const {
    includeChangeInHistory,
    includePatchInChangeGroup,
    promptForAIChangeGroupSummary: promptForAutoChangeGroupDescription,
    fallbackSummaryForChangeGroup,
  } = dataType ?? {};

  // todo: extract this as an interface that different doc types can implement
  const changeGroupingOptions = useMemo<
    Omit<
      ChangeGroupingOptions<HasVersionControlMetadata<unknown, unknown>>,
      "markers"
    >
  >(() => {
    return {
      grouping: groupingByEditTime(30),
      includeChangeInHistory,
      includePatchInChangeGroup,
      fallbackSummaryForChangeGroup,
    };
  }, [
    dataType.id,
    includeChangeInHistory,
    includePatchInChangeGroup,
    fallbackSummaryForChangeGroup,
  ]);

  const changelogItems = useTimelineItems(handle, changeGroupingOptions);

  const hiddenItemBoundary = changelogItems.findIndex(
    (item) => item.type === "originOfThisBranch" && item.hideHistoryBeforeThis
  );

  let visibleItems = changelogItems;
  if (hiddenItemBoundary > 0 && !showHiddenItems) {
    visibleItems = visibleItems.slice(hiddenItemBoundary);
  }

  // Within a branch, don't show new branches created after this branch started
  if (selectedBranch) {
    const originIndex = visibleItems.findIndex(
      (item) => item.type === "originOfThisBranch"
    );
    visibleItems = visibleItems.filter((item, index) => {
      if (item.type === "branchCreatedFromThisDoc" && index > originIndex) {
        return false;
      }
      return true;
    });
  }

  const { selection, handleClick, clearSelection, itemsContainerRef } =
    useChangelogSelection({
      items: changelogItems ?? [],
      setDiff,
      setDocHeads,
    });

  const changeGroups = useMemo(() => {
    return changelogItems.flatMap((item) => {
      if (item.type === "changeGroup") {
        return [item.changeGroup];
      } else if (item.type === "otherBranchMergedIntoThisDoc") {
        return item.changeGroups;
      } else {
        return [];
      }
    });
  }, [changelogItems]);

  useAutoPopulateChangeGroupSummaries({
    changeGroups,
    handle,
    promptForAutoChangeGroupDescription,
  });

  if (!doc) return null;

  // @ts-expect-error window global
  window.populateChangeSummaries = () =>
    populateChangeGroupSummaries({
      groups: changelogItems.flatMap((item) =>
        item.type === "changeGroup" ? [item.changeGroup] : []
      ),
      promptForAutoChangeGroupDescription,
      handle,
    });

  return (
    <div className="h-full w-full flex flex-col text-xs text-gray-600">
      {/* Show which branch we're on  */}
      <div className="bg-gray-50 border-gray-200 border-b">
        <div className="flex items-center">
          <div
            className="cursor-pointer text-gray-500 font-semibold underline w-12 flex-shrink-0"
            onClick={() => setSelectedBranch(null)}
          >
            {selectedBranch && (
              <>
                <ChevronLeftIcon size={12} className="inline" />
                Main
              </>
            )}
          </div>
          <div className="flex-grow flex justify-center items-center px-2 py-1 text-sm">
            <div className="font-medium text-gray-800">
              {!selectedBranch && (
                <div className="flex items-center gap-2">
                  <CrownIcon className="inline" size={12} />
                  Main
                </div>
              )}
              {selectedBranch && (
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="inline" size={12} />
                  {selectedBranch.name}
                </div>
              )}
            </div>
          </div>
          <div className="w-12 flex-shrink-0"></div>
        </div>
        {selection && (
          <div className="absolute flex gap-2 p-2 bg-gray-100 z-10 w-full border-b border-t border-gray-300">
            <div className="text-blue-600 font-medium">
              Showing {selection.to.index - selection.from.index + 1} change
              {selection.to.index === selection.from.index ? "" : "s"}
            </div>
            <div
              className="cursor-pointer text-gray-500 font-semibold underline"
              onClick={clearSelection}
            >
              Reset to now
            </div>
          </div>
        )}
      </div>

      {/* The timeline */}
      <div
        className="bg-gray-100 overflow-y-auto flex-1 flex flex-col pb-4"
        ref={scrollerRef}
      >
        <div className="timeline-line"></div>
        <div className="relative mt-auto flex flex-col" ref={itemsContainerRef}>
          {/* Show a toggle for hidden items */}
          <div className="pl-6 text-xs  text-gray-500">
            {!showHiddenItems && hiddenItemBoundary > 0 && (
              <div className="flex gap-2">
                <div>{hiddenItemBoundary + 1} items before branch creation</div>
                <div
                  className="font-semibold cursor-pointer underline"
                  onClick={() => setShowHiddenItems(true)}
                >
                  show
                </div>
              </div>
            )}
          </div>

          {visibleItems.map((item, index) => {
            const selected =
              selection &&
              index >= selection.from.index &&
              index <= selection.to.index;

            const dateChangedFromPrevItem =
              new Date(changelogItems[index - 1]?.time).toDateString() !==
              new Date(item.time).toDateString();

            return (
              <>
                {dateChangedFromPrevItem && (
                  <div className="text-xs text-gray-400">
                    <DateHeader date={new Date(item.time)} />
                  </div>
                )}
                <div
                  key={item.id}
                  data-item-id={item.id}
                  className={`p-2 cursor-default select-none w-full flex items-start gap-2 ${
                    selected ? "bg-blue-100 bg-opacity-20" : ""
                  }`}
                  onClick={(e) =>
                    handleClick({ itemId: item.id, shiftPressed: e.shiftKey })
                  }
                >
                  {(() => {
                    switch (item.type) {
                      case "changeGroup":
                        return (
                          <ChangeGroupItem
                            group={item.changeGroup}
                            doc={doc}
                            selected={selected}
                          />
                        );
                      case "tag":
                        return (
                          <MilestoneItem
                            milestone={item.tag}
                            selected={selected}
                          />
                        );
                      case "branchCreatedFromThisDoc":
                        return (
                          <BranchCreatedItem
                            selectedBranch={selectedBranch}
                            setSelectedBranch={setSelectedBranch}
                            branch={item.branch}
                            selected={selected}
                          />
                        );
                      case "discussionThread":
                        return (
                          <DiscussionThreadItem
                            discussion={item.discussion}
                            selected={selected}
                          />
                        );
                      case "originOfThisBranch":
                        return (
                          <BranchOriginItem
                            branch={item.branch}
                            selected={selected}
                          />
                        );
                      case "otherBranchMergedIntoThisDoc":
                        return (
                          <BranchMergedItem
                            doc={doc}
                            branch={item.branch}
                            selected={selected}
                            changeGroups={item.changeGroups}
                          />
                        );
                      default: {
                        // Ensure we've handled all types
                        const exhaustiveCheck: never = item;
                        return exhaustiveCheck;
                      }
                    }
                  })()}

                  {/* User avatars associated with this item */}
                  {item.type !== "discussionThread" && (
                    <div className="ml-auto flex-shrink-0 flex items-center gap-2">
                      <div className="flex items-center space-x-[-4px]">
                        {item.users.map((contactUrl) => (
                          <div className="rounded-full" key={contactUrl}>
                            <InlineContactAvatar
                              key={contactUrl}
                              url={contactUrl}
                              size="sm"
                              showName={false}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Context menu for the item (TODO: how to populate actions for this?) */}
                      <div className="mt-1 -mx-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <MoreVerticalIcon
                              size={18}
                              className="text-gray-300 hover:text-gray-800"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="mr-4">
                            {(item.type === "otherBranchMergedIntoThisDoc" ||
                              item.type === "branchCreatedFromThisDoc") && (
                              <DropdownMenuItem
                                onClick={() => setSelectedBranch(item.branch)}
                              >
                                Go to branch
                              </DropdownMenuItem>
                            )}

                            {item.type === "changeGroup" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  const summary = window.prompt(
                                    "New summary:",
                                    doc.changeGroupSummaries[
                                      item.changeGroup.id
                                    ]?.title ?? ""
                                  );
                                  if (summary) {
                                    handle.change((doc) => {
                                      doc.changeGroupSummaries[
                                        item.changeGroup.id
                                      ] = {
                                        title: summary,
                                      };
                                    });
                                  }
                                }}
                              >
                                <PencilIcon size={12} className="mr-1 inline" />
                                Edit summary
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })}

          {/* Blue selection box overlay */}
          {selection && (
            <div
              className="absolute left-1 right-1 border-2 border-blue-600 rounded-lg transition-all duration-200 pointer-events-none"
              style={{
                top: selection.from.yPos,
                height: selection.to.yPos - selection.from.yPos,
              }}
            ></div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 z-10">
        <DiscussionInput
          doc={doc}
          changeDoc={changeDoc}
          changelogItems={changelogItems}
          changelogSelection={selection}
          handle={handle}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
        />
      </div>
    </div>
  );
};

// Manage the selection state for changelog items.
// Supports multi-select interaction.
// Returns pixel coordinates for the selection to help w/ drawing a selection box.
const useChangelogSelection = function <T>({
  items,
  setDiff,
  setDocHeads,
}: {
  items: TimelineItems<T>[];
  setDiff: (diff: DiffWithProvenance) => void;
  setDocHeads: (heads: Heads) => void;
}): {
  // The current selection
  selection: ChangelogSelection;
  // Click handler for the items
  handleClick: ({ itemId, shiftPressed }) => void;
  // Ref for the container of the items
  itemsContainerRef: React.RefObject<HTMLDivElement>;
  // Callback to clear the selection
  clearSelection: () => void;
} {
  // Internally we track selection using item IDs.
  // Once we return it out of the hook, we'll also tack on numbers, to help out in the view.
  const [selection, setSelection] = useState<{ from: string; to: string }>(
    undefined
  );

  // sync the diff and docHeads up to the parent component when the selection changes
  useEffect(() => {
    if (!selection) {
      setDiff(undefined);
      setDocHeads(undefined);
    }

    const fromItemIndex = items.findIndex(
      (item) => item.id === selection?.from
    );
    const previousItem = items[fromItemIndex - 1];
    const fromItem = items[fromItemIndex];
    const toItem = items.find((item) => item.id === selection?.to);
    const fromIndex = items.findIndex((item) => item.id === selection?.from);
    const toIndex = items.findIndex((item) => item.id === selection?.to);

    if (!fromItem || !toItem) {
      return;
    }

    setDocHeads(toItem.heads);

    // The diff consists of diffs from any change groups in the selected items.
    const selectedItems = items.slice(fromIndex, toIndex + 1);
    const patches = selectedItems
      .flatMap((item) => {
        if (item.type === "changeGroup") {
          return item.changeGroup.diff.patches;
        } else if (item.type === "otherBranchMergedIntoThisDoc") {
          return item.changeGroups.flatMap((group) => group.diff.patches);
        }
      })
      .filter((patch) => patch !== undefined);
    setDiff({
      patches,
      fromHeads: previousItem?.heads ?? [],
      toHeads: toItem.heads,
    });
  }, [selection, setDiff, setDocHeads, items]);

  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const handleClick = ({ itemId, shiftPressed }) => {
    if (!shiftPressed) {
      setSelection({ from: itemId, to: itemId });
      return;
    }

    // If the shift key is pressed, we create a multi-change selection.
    // If there's no existing change group selected, just use the latest as the starting point for the selection.
    if (!selection) {
      const to = items[items.length - 1].id;
      setSelection({ from: itemId, to });
      return;
    }

    // If there was already a selection, extend it.
    const fromIndex = items.findIndex((item) => item.id === selection.from);
    const clickedIndex = items.findIndex((item) => item.id === itemId);

    if (clickedIndex < fromIndex) {
      setSelection({ from: itemId, to: selection.to });
      return;
    } else {
      setSelection({ from: selection.from, to: itemId });
      return;
    }
  };

  if (!selection || !itemsContainerRef.current) {
    return {
      selection: undefined,
      handleClick,
      itemsContainerRef,
      clearSelection: () => setSelection(undefined),
    };
  }

  const fromIndex = items.findIndex((item) => item.id === selection?.from);
  const toIndex = items.findIndex((item) => item.id === selection?.to);

  const containerTop = itemsContainerRef.current.getBoundingClientRect().top;
  const fromPos =
    [...itemsContainerRef.current.children]
      .find((div) => div.attributes["data-item-id"]?.value === selection.from)
      ?.getBoundingClientRect().top - containerTop;

  const toPos =
    [...(itemsContainerRef.current?.children ?? [])]
      .find((div) => div.attributes["data-item-id"]?.value === selection.to)
      ?.getBoundingClientRect().bottom - containerTop;

  return {
    selection: {
      from: {
        itemId: selection.from,
        index: fromIndex,
        yPos: fromPos,
      },
      to: {
        itemId: selection.to,
        index: toIndex,
        yPos: toPos,
      },
    },
    handleClick,
    itemsContainerRef,
    clearSelection: () => setSelection(undefined),
  };
};

const ChangeGroupItem: React.FC<{
  group: GenericChangeGroup;
  doc: HasVersionControlMetadata<unknown, unknown>;
  selected: boolean;
}> = ({ group, doc }) => {
  return (
    <div className="pl-[7px] pr-1 flex w-full">
      <div className="flex-shrink-0 w-3 h-3 border-b-2 border-l-2 border-gray-300 rounded-bl-full"></div>
      <ChangeGroupDescription changeGroup={group} doc={doc} />
    </div>
  );
};

const DateHeader: React.FC<{ date: Date }> = ({ date }) => {
  return (
    <div className="text-sm font-normal text-gray-300 px-4 flex items-center justify-between p-1 w-full">
      <hr className="flex-grow border-t border-gray-200 mr-2 ml-4" />
      <div>
        {date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          weekday: "long",
        })}
      </div>
    </div>
  );
};

// Summary of a change group: textual + avatars
const ChangeGroupDescription = ({
  changeGroup,
  doc,
}: {
  changeGroup: GenericChangeGroup;
  doc: HasChangeGroupSummaries;
}) => {
  let summary;
  if (!doc.changeGroupSummaries || !doc.changeGroupSummaries[changeGroup.id]) {
    summary = changeGroup.fallbackSummary;
  } else {
    summary = doc.changeGroupSummaries[changeGroup.id].title;
  }
  return (
    <div className={`group  p-1 rounded-full font-medium text-xs flex`}>
      <div className="mr-2 text-gray-500">{summary}</div>
    </div>
  );
};

const BranchMergedItem: React.FC<{
  doc: HasChangeGroupSummaries;
  branch: Branch;
  changeGroups: GenericChangeGroup[];
  selected: boolean;
}> = ({ doc, branch, changeGroups, selected }) => {
  return (
    <ItemView selected={selected} color="purple">
      <ItemActionMessage>branch merged</ItemActionMessage>
      <ItemIcon>
        <GitBranchPlusIcon
          className="h-[10px] w-[10px] text-white"
          strokeWidth={2}
        />
      </ItemIcon>

      <ItemContent>
        <div className="text-sm flex flex-col gap-1 select-none">
          <div>
            <div className="inline font-semibold">{branch.name}</div>{" "}
          </div>
          {changeGroups.map((group) => (
            <div className="flex" key={group.id}>
              <ChangeGroupDescription changeGroup={group} doc={doc} />
              <div className="flex flex-shrink-0 items-start space-x-[-4px]">
                {group.authorUrls.map((contactUrl) => (
                  <div className="rounded-full" key={contactUrl}>
                    <InlineContactAvatar
                      key={contactUrl}
                      url={contactUrl}
                      size="sm"
                      showName={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ItemContent>
    </ItemView>
  );
};

const MilestoneItem = ({
  milestone,
  selected,
}: {
  milestone: Tag;
  selected: boolean;
}) => {
  return (
    <div
      className={`timeline-item w-full outline outline-2 outline-gray-50 cursor-pointer items-center flex gap-1 rounded-full -ml-1 pl-1 border-1.5 border-gray-300 shadow-sm ${
        selected ? "bg-gray-200" : "bg-gray-100"
      }`}
    >
      <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-orange-500 outline outline-2 outline-gray-100">
        <MilestoneIcon className="h-[12px] w-[12px] text-white" />
      </div>

      <div className="flex-1 p-1 text-sm ">
        <div className="font-semibold">{milestone.name}</div>
      </div>
    </div>
  );
};

const BranchCreatedItem = ({
  branch,
  selected,
}: {
  branch: Branch;
  selected: boolean;
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
}) => {
  return (
    <ItemView selected={selected} color="neutral">
      <ItemActionMessage>branch created</ItemActionMessage>
      <ItemIcon>
        <GitBranchIcon className="h-[10px] w-[10px] text-neutral-600" />
      </ItemIcon>
      <ItemContent>
        <div>
          <div className="text-sm flex select-none items-center">
            <div className="mb-1">
              <div className="inline font-semibold">{branch.name}</div>{" "}
            </div>
          </div>
        </div>
      </ItemContent>
    </ItemView>
  );
};

const BranchOriginItem = ({
  branch,
  selected,
}: {
  branch: Branch;
  selected: boolean;
}) => {
  return (
    <ItemView selected={selected} color="green">
      <ItemActionMessage>this branch started</ItemActionMessage>
      <ItemIcon>
        <GitBranchIcon className="h-[10px] w-[10px] text-white" />
      </ItemIcon>
      <ItemContent>
        <div>
          <div className="text-sm flex select-none items-center">
            <div className="mb-1">
              <div className="inline font-semibold">{branch.name}</div>{" "}
            </div>
          </div>
        </div>
      </ItemContent>
    </ItemView>
  );
};

// Show a discussion thread about the document.
// We only show discussions about the whole doc in this timeline view,
// not discussions about specific parts of the doc.
// We only show the first comment in the thread (replying isn't supported yet)
const DiscussionThreadItem = ({
  discussion,
}: {
  discussion: Discussion<unknown>;
  selected: boolean;
}) => {
  const comment = discussion.comments[0];
  return (
    <div className="ml-6 mr-16 my-0 w-full min-h-12 flex gap-1 bg-yellow-50 border-yellow-100 text-xs p-2 shadow-md select-none">
      <div className="flex-shrink-0">
        <InlineContactAvatar
          size="default"
          url={comment.contactUrl}
          showName={false}
        />
      </div>
      <div className="font-normal text-gray-800 -ml-1 -my-1">
        {/* We use a readonly Codemirror to show markdown preview for comments
                                        using the same style that was used for entering the comment */}
        <CodeMirror
          value={comment.content.trim()}
          readOnly
          editable={false}
          basicSetup={{
            foldGutter: false,
            highlightActiveLine: false,
            lineNumbers: false,
          }}
          extensions={[
            markdown({
              base: markdownLanguage,
              codeLanguages: languages,
            }),
            EditorView.lineWrapping,
          ]}
          theme={EditorView.theme({
            "&.cm-editor": {
              height: "100%",
            },
            "&.cm-focused": {
              outline: "none",
            },
            ".cm-scroller": {
              height: "100%",
            },
            ".cm-content": {
              height: "100%",
              fontSize: "12px",
              fontFamily: "monospace",
              fontWeight: "normal",
            },
          })}
        />
      </div>
    </div>
  );
};

const ItemIcon = ({ children }: { children: ReactNode }) => <>{children}</>;
const ItemContent = ({ children }: { children: ReactNode }) => <>{children}</>;
const ItemActionMessage = ({ children }: { children: ReactNode }) => (
  <>{children}</>
);

const ItemView = ({
  children,
  color = "neutral",
}: {
  selected: boolean;
  children: ReactNode | ReactNode[];
  color: string;
}) => {
  const [slots] = useSlots(children, {
    icon: ItemIcon,
    content: ItemContent,
    actionMessage: ItemActionMessage,
  });

  const tailwindColor =
    {
      purple: "bg-purple-600",
      green: "bg-green-600",
      neutral: "bg-neutral-300",
      orange: "bg-amber-600",
    }[color] ?? "bg-neutral-600";

  return (
    <div className="items-top flex gap-1 w-full pr-4">
      {slots.icon && (
        <div
          className={`${tailwindColor} mt-1.5 flex h-[16px] w-[16px] items-center justify-center rounded-full  outline outline-2 outline-gray-100`}
        >
          {slots.icon}
        </div>
      )}

      {!slots.icon && <div className="w-[16px] h-[16px] mt-1.5" />}
      <div className="flex-1 flex-grow px-1">
        {slots.actionMessage && (
          <div className="my-1 font-medium text-gray-500">
            {slots.actionMessage}
          </div>
        )}
        <div className={`bg-white flex-1 rounded py-1 px-2 shadow`}>
          {slots.content}
        </div>
      </div>
    </div>
  );
};
