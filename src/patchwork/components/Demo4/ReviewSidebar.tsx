import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import CodeMirror from "@uiw/react-codemirror";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, {
  useEffect,
  useMemo,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import {
  ChangeGroup,
  getChangelogItems,
  getMarkersForDoc,
} from "../../groupChanges";

import {
  MessageSquare,
  MilestoneIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  MoreHorizontal,
} from "lucide-react";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import { Branch, DiffWithProvenance, Discussion, Tag } from "../../schema";
import { useCurrentAccount } from "@/DocExplorer/account";
import { useSlots } from "@/patchwork/utils";
import { TextSelection } from "@/tee/components/MarkdownEditor";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import { populateChangeGroupSummaries } from "@/patchwork/changeGroupSummaries";
import { debounce, isEqual } from "lodash";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const useScrollToBottom = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [scrollerRef.current]);
  return scrollerRef;
};

export const ReviewSidebar: React.FC<{
  docUrl: AutomergeUrl;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
  textSelection: TextSelection;
  onClearTextSelection: () => void;
}> = ({
  docUrl,
  setDocHeads,
  setDiff,
  selectedBranch,
  setSelectedBranch,
  textSelection,
  onClearTextSelection,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const repo = useRepo();
  const account = useCurrentAccount();
  const scrollerRef = useScrollToBottom();

  // TODO: technically this should also update when the "source doc" for this branch updates
  const markers = useMemo(
    () => getMarkersForDoc(handle, repo),
    // Important to have doc as a dependency here even though the linter says not needed
    [doc, handle, repo]
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

  return (
    <div className="history h-full w-full flex flex-col gap-2 text-xs text-gray-600">
      <div className="overflow-y-auto flex-1 flex flex-col" ref={scrollerRef}>
        <div className="mt-auto flex flex-col gap-4">
          {changelogItems.map((item) => (
            <div key={item.id} className="px-2 w-full flex items-start gap-2">
              {(() => {
                const selected = false;
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
                      <MilestoneItem milestone={item.tag} selected={selected} />
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
                      />
                    );
                  default: {
                    // Ensure we've handled all types
                    const exhaustiveCheck: never = item;
                    return exhaustiveCheck;
                  }
                }
              })()}
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
          ))}
        </div>
      </div>
      <div className="bg-gray-50 z-10">
        <CommentBox />
      </div>
    </div>
  );
};

const CommentBox = () => {
  return <div className="h-16 bg-red-100 p-5">Comment box</div>;
};

const ChangeGroupItem: React.FC<{
  group: ChangeGroup;
  doc: MarkdownDoc;
  selected: boolean;
}> = ({ group, selected, doc }) => {
  return (
    <div className="pl-[7px] pr-1 flex w-full">
      <div className="w-3 h-3 border-b-2 border-l-2 border-gray-300 rounded-bl-full"></div>
      <ChangeGroupDescription
        changeGroup={group}
        selected={selected}
        doc={doc}
      />
    </div>
  );
};

// Summary of a change group: textual + avatars
const ChangeGroupDescription = ({
  changeGroup,
  selected,
  doc,
}: {
  changeGroup: ChangeGroup;
  selected: boolean;
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
    <div
      className={`w-full group cursor-pointer  p-1 rounded-full font-medium text-xs flex ${
        selected ? "bg-blue-100 bg-opacity-50" : "bg-transparent"
      } `}
    >
      <div className="mr-2 text-gray-500">{summary}</div>
    </div>
  );
};

const BranchMergedItem: React.FC<{ branch: Branch; selected: boolean }> = ({
  branch,
  selected,
}) => {
  return (
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
  selectedBranch,
  setSelectedBranch,
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

          {!isEqual(selectedBranch, {
            type: "branch",
            url: branch.url,
          }) && (
            <div
              className="text-xs text-gray-400 hover:text-gray-600 font-semibold cursor-pointer select-none flex-shrink-0"
              onClick={() =>
                setSelectedBranch({
                  type: "branch",
                  url: branch.url,
                })
              }
            >
              View branch {">"}
            </div>
          )}
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
  selected,
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
      <div
        className={`cursor-pointer flex-1 rounded py-1 px-2 shadow ${
          selected ? "bg-blue-100" : "bg-white"
        }`}
      >
        {slots.content}
      </div>
    </div>
  );
};
