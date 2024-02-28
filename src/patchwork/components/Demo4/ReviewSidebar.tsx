import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import CodeMirror from "@uiw/react-codemirror";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useEffect, useMemo, useRef, ReactNode, useState } from "react";
import {
  ChangeGroup,
  ChangelogItem,
  getChangelogItems,
  getMarkersForDoc,
} from "../../groupChanges";

import {
  MessageSquare,
  MilestoneIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  MoreHorizontal,
  CrownIcon,
  ChevronLeftIcon,
} from "lucide-react";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import { Branch, DiffWithProvenance, Discussion, Tag } from "../../schema";
import { useSlots } from "@/patchwork/utils";
import { TextSelection } from "@/tee/components/MarkdownEditor";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscussionInput } from "./DiscussionInput";

const useScrollToBottom = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [scrollerRef.current]);
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
export type ChangelogSelection =
  | { from: ChangelogSelectionAnchor; to: ChangelogSelectionAnchor }
  | undefined;

export const ReviewSidebar: React.FC<{
  docUrl: AutomergeUrl;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
  textSelection: TextSelection;
  onClearTextSelection: () => void;
}> = ({
  docUrl,
  selectedBranch,
  setSelectedBranch,
  setDocHeads,
  setDiff,
  textSelection,
  onClearTextSelection,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [mainDoc] = useDocument<MarkdownDoc>(doc?.branchMetadata?.source?.url);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const repo = useRepo();
  const scrollerRef = useScrollToBottom();
  const [showHiddenItems, setShowHiddenItems] = useState(false);

  // TODO: technically this should also update when the "source doc" for this branch updates
  const markers = useMemo(
    () => getMarkersForDoc(handle, repo),
    // Important to have doc as a dependency here even though the linter says not needed
    [doc, handle, repo, mainDoc]
  );

  // The grouping function returns change groups starting from the latest change.
  const changelogItems = useMemo(() => {
    if (!doc) return [];

    return getChangelogItems(doc, {
      algorithm: "ByAuthorOrTime",
      numericParameter: 60,
      markers,
    });
  }, [doc, markers]);

  const hiddenItemBoundary = changelogItems.findIndex(
    (item) => item.type === "originOfThisBranch" && item.hideHistoryBeforeThis
  );

  const visibleItems =
    hiddenItemBoundary > 0 && !showHiddenItems
      ? changelogItems.slice(hiddenItemBoundary)
      : changelogItems;

  const { selection, handleClick, clearSelection, itemsContainerRef } =
    useChangelogSelection({
      items: changelogItems ?? [],
      setDiff,
      setDocHeads,
    });

  if (!doc) return null;

  const selectedBranchLink =
    selectedBranch.type === "branch"
      ? mainDoc?.branchMetadata.branches.find(
          (b) => b.url === selectedBranch.url
        )
      : undefined;

  return (
    <div className="h-full w-full flex flex-col text-xs text-gray-600">
      {/* Show which branch we're on  */}
      <div className="bg-gray-50 border-gray-200 border-b">
        <div className="flex items-center">
          <div
            className="cursor-pointer text-gray-500 font-semibold underline w-12 flex-shrink-0"
            onClick={() => setSelectedBranch({ type: "main" })}
          >
            {selectedBranch.type === "branch" && (
              <>
                <ChevronLeftIcon size={12} className="inline" />
                Main
              </>
            )}
          </div>
          <div className="flex-grow flex justify-center items-center px-2 py-1 text-sm">
            <div className="font-bold">
              {selectedBranch.type === "main" && (
                <div className="flex items-center gap-2">
                  <CrownIcon className="inline" size={12} />
                  Main
                </div>
              )}
              {selectedBranch.type === "branch" && (
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="inline" size={12} />
                  {selectedBranchLink?.name}
                </div>
              )}
            </div>
          </div>
          <div className="w-12 flex-shrink-0"></div>
        </div>

        <div className="h-6">
          {selection && (
            <div className="flex gap-2 px-2 pb-1">
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
      </div>

      {/* The timeline */}
      <div
        className="timeline overflow-y-auto flex-1 flex flex-col"
        ref={scrollerRef}
      >
        {/* Show a toggle for hidden items */}

        <div className="relative mt-auto flex flex-col" ref={itemsContainerRef}>
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
                            branch={item.branch}
                            selected={selected}
                            changeGroups={item.changeGroups}
                            doc={doc}
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
                  <div className="ml-auto flex-shrink-0 flex items-center gap-2">
                    <div className="flex items-center space-x-[-4px]">
                      {item.users.map((contactUrl) => (
                        <div className="rounded-full">
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
                    <div className="">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <MoreHorizontal
                            size={18}
                            className="mt-1 mr-21 text-gray-300 hover:text-gray-800"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="mr-4">
                          <DropdownMenuItem>
                            Context actions go here
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </>
            );
          })}

          {/* Blue selection box overlay */}
          {selection && (
            <div
              className="absolute w-full border-2 border-blue-600 rounded-lg transition-all duration-200 pointer-events-none"
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
          textSelection={textSelection}
          onClearTextSelection={onClearTextSelection}
        />
      </div>
    </div>
  );
};

// Manage the selection state for changelog items.
// Supports multi-select interaction.
// Returns pixel coordinates for the selection to help w/ drawing a selection box.
const useChangelogSelection = ({
  items,
  setDiff,
  setDocHeads,
}: {
  items: ChangelogItem[];
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
} => {
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

    const fromItem = items.find((item) => item.id === selection?.from);
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
    setDiff({ patches, fromHeads: fromItem.heads, toHeads: toItem.heads });
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
  group: ChangeGroup;
  doc: MarkdownDoc;
  selected: boolean;
}> = ({ group, doc }) => {
  return (
    <div className="pl-[7px] pr-1 flex w-full">
      <div className="w-3 h-3 border-b-2 border-l-2 border-gray-300 rounded-bl-full"></div>
      <ChangeGroupDescription changeGroup={group} doc={doc} />
    </div>
  );
};

const DateHeader: React.FC<{ date: Date }> = ({ date }) => {
  return (
    <div className="text-sm font-medium text-gray-400 px-4 flex items-center justify-between p-1 w-full">
      <hr className="flex-grow border-t border-gray-200 mr-2 ml-4" />
      <div>
        {date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          weekday: "short",
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
  changeGroup: ChangeGroup;
  doc: MarkdownDoc;
}) => {
  let summary;
  if (!doc.changeGroupSummaries || !doc.changeGroupSummaries[changeGroup.id]) {
    // TODO: filter these patches to only include the ones that are relevant to the markdown doc
    summary = `${changeGroup.diff.patches.length} edits`;
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
  branch: Branch;
  changeGroups: ChangeGroup[];
  selected: boolean;
  doc: MarkdownDoc;
}> = ({ branch, changeGroups, selected, doc }) => {
  return (
    <div>
      <ItemView selected={selected} color="purple">
        <ItemIcon>
          <GitBranchPlusIcon
            className="h-[10px] w-[10px] text-white"
            strokeWidth={2}
          />
        </ItemIcon>

        <ItemContent>
          <div className="text-sm flex select-none">
            <div>
              <div className="inline font-normal">Branch merged:</div>{" "}
              <div className="inline font-semibold">{branch.name}</div>{" "}
            </div>
          </div>
        </ItemContent>
      </ItemView>
      {changeGroups.map((group) => (
        <div className="pl-6 flex">
          <ChangeGroupItem group={group} selected={selected} doc={doc} />
          <div className="flex items-center space-x-[-4px]">
            {group.authorUrls.map((contactUrl) => (
              <div className="rounded-full">
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
    <ItemView selected={selected} color="green">
      <ItemIcon>
        <MilestoneIcon className="h-[10px] w-[10px] text-white" />
      </ItemIcon>
      <ItemContent>
        <div className="text-sm flex select-none">
          <div>
            <div className="inline font-normal">Milestone:</div>{" "}
            <div className="inline font-semibold">{milestone.name}</div>{" "}
          </div>
        </div>
      </ItemContent>
    </ItemView>
  );
};

const BranchCreatedItem = ({
  branch,
  selected,
}: {
  branch: Branch;
  selected: boolean;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
}) => {
  return (
    <ItemView selected={selected} color="neutral">
      <ItemIcon>
        <GitBranchIcon className="h-[10px] w-[10px] text-neutral-600" />
      </ItemIcon>
      <ItemContent>
        <div>
          <div className="text-sm flex select-none items-center">
            <div className="mb-1">
              <div className="inline font-normal">Branch created:</div>{" "}
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
    <ItemView selected={selected} color="neutral">
      <ItemIcon>
        <GitBranchIcon className="h-[10px] w-[10px] text-neutral-600" />
      </ItemIcon>
      <ItemContent>
        <div>
          <div className="text-sm flex select-none items-center">
            <div className="mb-1">
              <div className="inline font-normal">This branch started:</div>{" "}
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
  selected,
}: {
  discussion: Discussion;
  selected: boolean;
}) => {
  const comment = discussion.comments[0];
  return (
    <ItemView selected={selected} color="orange">
      <ItemIcon>
        <MessageSquare className="h-[10px] w-[10px] text-white" />
      </ItemIcon>
      <ItemContent>
        <div className="text-sm flex select-none">
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
                  fontSize: "14px",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif",
                  fontWeight: "normal",
                },
              })}
            />
          </div>
        </div>
      </ItemContent>
    </ItemView>
  );
};

const ItemIcon = ({ children }: { children: ReactNode }) => <>{children}</>;
const ItemContent = ({ children }: { children: ReactNode }) => <>{children}</>;

const ItemView = ({
  children,
  color = "neutral",
}: {
  selected: boolean;
  children: ReactNode | ReactNode[];
  color: string;
}) => {
  const [slots] = useSlots(children, { icon: ItemIcon, content: ItemContent });

  const tailwindColor =
    {
      purple: "bg-purple-600",
      green: "bg-green-600",
      neutral: "bg-neutral-300",
      orange: "bg-amber-600",
    }[color] ?? "bg-neutral-600";

  return (
    <div className="items-top flex gap-1">
      {slots.icon && (
        <div
          className={`${tailwindColor} mt-1.5 flex h-[16px] w-[16px] items-center justify-center rounded-full  outline outline-2 outline-gray-100`}
        >
          {slots.icon}
        </div>
      )}

      {!slots.icon && <div className="w-[16px] h-[16px] mt-1.5" />}
      <div className={`flex-1 rounded py-1 px-2 shadow`}>{slots.content}</div>
    </div>
  );
};
