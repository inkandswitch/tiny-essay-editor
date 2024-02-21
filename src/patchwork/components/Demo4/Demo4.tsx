import { MarkdownDoc } from "@/tee/schema";
import { DiffWithProvenance } from "../../schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { isEqual, truncate } from "lodash";
import * as A from "@automerge/automerge/next";
import {
  ChevronsRight,
  CrownIcon,
  Edit3Icon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitMergeIcon,
  HistoryIcon,
  MergeIcon,
  MessageSquareIcon,
  MilestoneIcon,
  MinusSquareIcon,
  MoreHorizontal,
  PlusIcon,
  PlusSquareIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";
import { diffWithProvenance, useActorIdToAuthorMap } from "../../utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentAccount } from "@/DocExplorer/account";
import { getRelativeTimeString } from "@/DocExplorer/utils";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { Checkbox } from "@/components/ui/checkbox";
import { combinePatches } from "../../utils";
import { HistoryZoomLevel, ReviewSidebar } from "./ReviewSidebar";
import { Hash } from "../Hash";
import {
  createBranch,
  deleteBranch,
  mergeBranch,
  suggestBranchName,
} from "../../branches";
import { Slider } from "@/components/ui/slider";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import { toast } from "sonner";

interface MakeBranchOptions {
  name?: string;
  heads?: A.Heads;
}

export const Demo4: React.FC<{
  docUrl: AutomergeUrl;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
}> = ({ docUrl, selectedBranch, setSelectedBranch }) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const account = useCurrentAccount();

  const [sessionStartHeads, setSessionStartHeads] = useState<A.Heads>();
  const [isHoveringYankToBranchOption, setIsHoveringYankToBranchOption] =
    useState(false);
  const [showChangesFlag, setShowChangesFlag] = useState<boolean>(true);
  const [compareWithMainFlag, setCompareWithMainFlag] =
    useState<boolean>(false);

  // Reset compare view settings every time you switch branches
  useEffect(() => {
    if (selectedBranch.type === "main") {
      setCompareWithMainFlag(false);
      setShowChangesFlag(false);
    }
    if (selectedBranch.type === "branch") {
      setShowChangesFlag(true);
      setCompareWithMainFlag(false);
    }
  }, [selectedBranch]);

  const [isHistorySidebarOpen, setIsHistorySidebarOpen] =
    useState<boolean>(false);

  useEffect(() => {
    if (!isHistorySidebarOpen) {
      setDiffFromHistorySidebar(undefined);
      setDocHeadsFromHistorySidebar(undefined);
    }
  }, [isHistorySidebarOpen]);
  const [diffFromHistorySidebar, setDiffFromHistorySidebar] =
    useState<DiffWithProvenance>();
  const [docHeadsFromHistorySidebar, setDocHeadsFromHistorySidebar] =
    useState<A.Heads>();

  useEffect(() => {
    if (!doc || sessionStartHeads) {
      return;
    }

    setSessionStartHeads(A.getHeads(doc));
  }, [doc]);

  const currentEditSessionDiff = useMemo(() => {
    if (!doc || !sessionStartHeads) {
      return undefined;
    }

    const diff = diffWithProvenance(doc, sessionStartHeads, A.getHeads(doc));

    return {
      ...diff,
      patches: combinePatches(
        diff.patches.filter((patch) => patch.path[0] === "content")
      ),
    };
  }, [doc, sessionStartHeads]);

  const actorIdToAuthor = useActorIdToAuthorMap(docUrl);

  const showDiff =
    (showChangesFlag && selectedBranch.type === "branch") ||
    isHoveringYankToBranchOption;

  // init branch metadata when the doc loads if it doesn't have it already
  useEffect(() => {
    if (doc && !doc.branchMetadata) {
      changeDoc(
        (doc) =>
          (doc.branchMetadata = {
            source: null,
            branches: [],
          })
      );
    }
  }, [doc, changeDoc]);

  const handleCreateBranch = useCallback(
    ({ name, heads }: MakeBranchOptions = {}) => {
      const branchHandle = createBranch({
        repo,
        handle,
        name,
        heads,
        createdBy: account?.contactHandle?.url,
      });
      setSelectedBranch({ type: "branch", url: branchHandle.url });
      toast("Created a new branch");
      return branchHandle;
    },
    [repo, handle, account?.contactHandle?.url]
  );

  const moveCurrentChangesToBranch = () => {
    // todo: only pull in changes the author made themselves?
    const latestText = doc.content;
    const textBeforeEditSession = A.view(doc, sessionStartHeads).content;

    // revert content of main to before edit session started
    handle.change((doc) => {
      A.updateText(doc, ["content"], textBeforeEditSession);
    });

    // Branch off after the revert is done -- this means that our
    // change to add back the edits won't be clobbered when we merge
    const branchHandle = handleCreateBranch();
    branchHandle.change((doc) => {
      A.updateText(doc, ["content"], latestText);
    });

    setSessionStartHeads(A.getHeads(doc));
    setIsHoveringYankToBranchOption(false);
  };

  const handleDeleteBranch = useCallback(
    (branchUrl: AutomergeUrl) => {
      setSelectedBranch({ type: "main" });
      deleteBranch({ docHandle: handle, branchUrl });
      toast("Deleted branch");
    },
    [handle]
  );

  const handleMergeBranch = useCallback(
    (branchUrl: AutomergeUrl) => {
      const branchHandle = repo.find<MarkdownDoc>(branchUrl);
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      mergeBranch({
        docHandle,
        branchHandle,
        mergedBy: account?.contactHandle?.url,
      });
      setSelectedBranch({ type: "main" });
      toast.success("Branch merged to main");
    },
    [docUrl, repo, account?.contactHandle?.url]
  );

  const rebaseBranch = (draftUrl: AutomergeUrl) => {
    const draftHandle = repo.find<MarkdownDoc>(draftUrl);
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    draftHandle.merge(docHandle);
    draftHandle.change((doc) => {
      doc.branchMetadata.source.branchHeads = A.getHeads(docHandle.docSync());
    });

    toast("Incorporated updates from main");
  };

  const renameBranch = useCallback(
    (draftUrl: AutomergeUrl, newName: string) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.change((doc) => {
        const copy = doc.branchMetadata.branches.find(
          (copy) => copy.url === draftUrl
        );
        if (copy) {
          copy.name = newName;
          toast(`Renamed branch to "${newName}"`);
        }
      });
    },
    [docUrl, repo]
  );

  const [branchDoc] = useDocument<MarkdownDoc>(
    selectedBranch.type === "branch" ? selectedBranch.url : undefined
  );

  const rawBranchDiff = useMemo(() => {
    if (branchDoc) {
      return diffWithProvenance(
        branchDoc,
        branchDoc.branchMetadata.source.branchHeads,
        A.getHeads(branchDoc)
      );
    }
  }, [branchDoc]);

  const branchDiff = useMemo(() => {
    //return rawBranchDiff;
    if (rawBranchDiff) {
      return {
        ...rawBranchDiff,
        patches: combinePatches(rawBranchDiff.patches),
      };
    }
  }, [rawBranchDiff]);

  const diffForEditor =
    diffFromHistorySidebar ??
    (showDiff ? branchDiff ?? currentEditSessionDiff : undefined);

  const diffBase =
    diffFromHistorySidebar?.fromHeads ??
    (showDiff
      ? branchDiff
        ? branchDiff?.fromHeads
        : currentEditSessionDiff?.fromHeads
      : undefined);

  const [historyZoomLevel, setHistoryZoomLevel] = useState<HistoryZoomLevel>(2);

  const branchDocHandle = useHandle<MarkdownDoc>(
    selectedBranch && selectedBranch.type === "branch"
      ? selectedBranch?.url
      : undefined
  );

  // ---- ALL HOOKS MUST GO ABOVE THIS EARLY RETURN ----

  if (!doc || !doc.branchMetadata) return <div>Loading...</div>;

  // ---- ANYTHING RELYING ON doc SHOULD GO BELOW HERE ----

  const branches = doc.branchMetadata.branches ?? [];

  const selectedBranchLink =
    selectedBranch.type === "branch" &&
    branches.find((b) => selectedBranch.url === b.url);

  // The selected draft doesn't have the latest from the main document
  // if the copy head stored on it don't match the latest heads of the main doc.
  const selectedBranchNeedsRebase =
    branchDoc &&
    !isEqual(A.getHeads(doc), branchDoc.branchMetadata.source.branchHeads);

  const docHeads = docHeadsFromHistorySidebar ?? undefined;

  const activeMilestone = doc?.tags?.find((t) => isEqual(t.heads, docHeads));

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="flex h-full">
          <div className="flex-grow">
            <div className="bg-gray-50 pl-4 pt-6 pb-1 flex gap-2 items-center">
              <Select
                value={JSON.stringify(selectedBranch)}
                onValueChange={(value) => {
                  if (value === "__newDraft") {
                    handleCreateBranch();
                  } else if (value === "__moveChangesToBranch") {
                    moveCurrentChangesToBranch();
                  } else {
                    const selection = JSON.parse(
                      value as string
                    ) as SelectedBranch;
                    setSelectedBranch(selection);
                    if (selection.type === "branch") {
                      const newBranchName = doc.branchMetadata.branches.find(
                        (b) => b.url === selection.url
                      )?.name;
                      toast(`Switched to branch: ${newBranchName}`);
                    } else if (selection.type === "main") {
                      toast("Switched to Main");
                    }
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm w-[18rem] font-medium">
                  <SelectValue placeholder="Select Draft">
                    {selectedBranch.type === "main" && (
                      <div className="flex items-center gap-2">
                        <CrownIcon className="inline" size={12} />
                        Main
                      </div>
                    )}
                    {selectedBranch.type === "branch" && (
                      <div className="flex items-center gap-2">
                        <GitBranchIcon className="inline" size={12} />
                        {truncate(selectedBranchLink?.name, { length: 30 })}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-72">
                  <SelectItem
                    value={JSON.stringify({ type: "main" })}
                    className={
                      selectedBranch.type === "main" ? "font-medium" : ""
                    }
                  >
                    <CrownIcon className="inline mr-1" size={12} />
                    Main
                  </SelectItem>
                  <SelectGroup>
                    <SelectLabel className="-ml-5">
                      <GitBranchIcon className="inline mr-1" size={12} />
                      Branches
                    </SelectLabel>

                    {/* for now only show open branches here; maybe in future show a list of merged branches */}
                    {branches
                      .filter((branch) => branch.mergeMetadata === undefined)
                      .map((branch) => (
                        <SelectItem
                          key={branch.url}
                          className={`${
                            selectedBranchLink?.url === branch.url
                              ? "font-medium"
                              : ""
                          }`}
                          value={JSON.stringify({
                            type: "branch",
                            url: branch.url,
                          })}
                        >
                          <div>{branch.name}</div>
                          <div className="ml-auto text-xs text-gray-600 flex gap-1">
                            {branch.createdAt && (
                              <div>
                                {getRelativeTimeString(branch.createdAt)}
                              </div>
                            )}
                            <span>by</span>
                            {branch.createdBy && (
                              <ContactAvatar
                                url={branch.createdBy}
                                size="sm"
                                showName
                                showImage={false}
                              />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    <SelectItem
                      value={"__newDraft"}
                      key={"__newDraft"}
                      className="font-regular"
                    >
                      <PlusIcon className="inline mr-1" size={12} />
                      Create new branch
                    </SelectItem>
                    {selectedBranch.type === "main" &&
                      currentEditSessionDiff &&
                      currentEditSessionDiff.patches.length > 0 && (
                        <SelectItem
                          value={"__moveChangesToBranch"}
                          key={"__moveChangesToBranch"}
                          className="font-regular"
                          onMouseEnter={() =>
                            setIsHoveringYankToBranchOption(true)
                          }
                          onMouseLeave={() =>
                            setIsHoveringYankToBranchOption(false)
                          }
                        >
                          <SplitIcon className="inline mr-1" size={12} />
                          Move my changes (
                          {currentEditSessionDiff?.patches.length}) to new
                          Branch
                        </SelectItem>
                      )}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {selectedBranch.type === "branch" && selectedBranchLink?.url && (
                <BranchActions
                  doc={doc}
                  branchDoc={branchDoc}
                  branchUrl={selectedBranchLink.url}
                  handleDeleteBranch={handleDeleteBranch}
                  handleRenameBranch={renameBranch}
                  handleRebaseBranch={rebaseBranch}
                  handleMergeBranch={handleMergeBranch}
                />
              )}

              {docHeads && diffForEditor.patches.length === 0 && (
                <div className="text-gray-500 flex gap-1">
                  as of{" "}
                  {activeMilestone ? (
                    <div className="inline">
                      <MilestoneIcon className="inline mr-1" size={12} />
                      {activeMilestone.name}
                    </div>
                  ) : (
                    docHeads[0]?.slice(0, 6)
                  )}
                </div>
              )}

              {docHeads && diffForEditor.patches.length > 0 && (
                <div className="text-gray-500 flex gap-1">
                  <div>comparing from</div>
                  {diffForEditor.fromHeads.length > 0 ? (
                    <Hash hash={diffForEditor.fromHeads[0]} />
                  ) : (
                    "beginning"
                  )}
                  <div>to</div>
                  <Hash hash={diffForEditor.toHeads[0] ?? ""} />
                </div>
              )}

              <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                {selectedBranch.type === "branch" && (
                  <div className="mr-2">
                    <Button
                      onClick={(e) => {
                        handleMergeBranch(selectedBranchLink.url);
                        e.stopPropagation();
                      }}
                      variant="outline"
                      className="h-6"
                    >
                      <MergeIcon className="mr-2" size={12} />
                      Merge
                    </Button>
                  </div>
                )}
                {selectedBranch.type === "branch" && (
                  <div className="flex items-center mr-1">
                    <Checkbox
                      id="diff-overlay-checkbox"
                      className="mr-1"
                      checked={showChangesFlag}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        setShowChangesFlag(!showChangesFlag)
                      }
                    />
                    <label htmlFor="diff-overlay-checkbox">
                      Highlight changes
                    </label>
                  </div>
                )}

                {selectedBranch.type === "branch" && (
                  <div className="flex items-center">
                    <Checkbox
                      id="side-by-side"
                      className="mr-1"
                      checked={compareWithMainFlag}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        setCompareWithMainFlag(!compareWithMainFlag)
                      }
                    />
                    <label htmlFor="side-by-side">Show next to main</label>
                  </div>
                )}
              </div>
              {!isHistorySidebarOpen && (
                <div
                  className={` ml-auto ${
                    isHistorySidebarOpen ? "mr-96" : "mr-4"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() =>
                        setIsHistorySidebarOpen(!isHistorySidebarOpen)
                      }
                      variant="outline"
                      className="h-8 text-x"
                    >
                      <MessageSquareIcon size={20} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-full items-stretch justify-stretch relative flex flex-col">
              {compareWithMainFlag && selectedBranchLink?.name && (
                <div className="w-full flex top-0 bg-gray-50 pt-4 text-sm font-medium">
                  <div className="flex-1 pl-4">
                    <div className="inline-flex items-center gap-1">
                      <CrownIcon className="inline mr-1" size={12} /> Main
                    </div>
                  </div>
                  <div className="flex-1 pl-4">
                    {" "}
                    <GitBranchIcon className="inline mr-1" size={12} />
                    {selectedBranchLink.name}
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="flex">
                  {selectedBranch.type === "branch" && compareWithMainFlag && (
                    <TinyEssayEditor
                      docUrl={docUrl}
                      branchDocHandle={branchDocHandle}
                      key={`compare-${docUrl}`}
                      diff={showDiff ? currentEditSessionDiff : undefined}
                      diffBase={
                        showDiff ? currentEditSessionDiff?.fromHeads : undefined
                      }
                      showDiffAsComments
                      actorIdToAuthor={actorIdToAuthor}
                    />
                  )}
                  <TinyEssayEditor
                    docUrl={selectedBranchLink?.url ?? docUrl}
                    mainDocHandle={compareWithMainFlag ? handle : undefined}
                    docHeads={docHeads}
                    readOnly={docHeads && !isEqual(docHeads, A.getHeads(doc))}
                    key={`main-${docUrl}`}
                    diff={diffForEditor}
                    diffBase={diffBase}
                    showDiffAsComments
                    actorIdToAuthor={actorIdToAuthor}
                    showBranchLayers={
                      selectedBranch.type === "branch" && !compareWithMainFlag
                    }
                    selectMainBranch={() => setSelectedBranch({ type: "main" })}
                  />
                </div>
              </div>
            </div>
          </div>

          {isHistorySidebarOpen && (
            <div className=" bg-white border-l border-gray-200 py-2 h-full overflow-hidden flex flex-col">
              <div className="px-2 pb-2 flex gap-2 items-center text-sm font-semibold text-gray-600 border-b border-gray-300 shadow-sm">
                <div
                  onClick={() => setIsHistorySidebarOpen(false)}
                  className="p-2 cursor-pointer hover:bg-gray-100 border hover:border-gray-500 rounded-lg w-8"
                >
                  <ChevronsRight size={16} />
                </div>
                <div className="flex gap-1">
                  <MessageSquareIcon size={16} />
                  Review
                </div>
                <div className="ml-4 flex gap-1">
                  <MinusSquareIcon size={12} />
                  <Slider
                    className="w-24"
                    min={1}
                    max={3}
                    step={1}
                    value={[historyZoomLevel]}
                    onValueChange={([value]) =>
                      setHistoryZoomLevel(value as HistoryZoomLevel)
                    }
                  />
                  <PlusSquareIcon size={12} />
                </div>
              </div>

              <div className="flex-grow overflow-hidden">
                <ReviewSidebar
                  // set key to trigger re-mount on branch change
                  key={selectedBranchLink?.url ?? docUrl}
                  docUrl={selectedBranchLink?.url ?? docUrl}
                  setDocHeads={setDocHeadsFromHistorySidebar}
                  setDiff={setDiffFromHistorySidebar}
                  zoomLevel={historyZoomLevel}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BranchActions: React.FC<{
  doc: MarkdownDoc;
  branchDoc: MarkdownDoc;
  branchUrl: AutomergeUrl;
  handleDeleteBranch: (branchUrl: AutomergeUrl) => void;
  handleRenameBranch: (branchUrl: AutomergeUrl, newName: string) => void;
  handleRebaseBranch: (branchUrl: AutomergeUrl) => void;
  handleMergeBranch: (branchUrl: AutomergeUrl) => void;
}> = ({
  doc,
  branchDoc,
  branchUrl,
  handleDeleteBranch,
  handleRenameBranch,
  handleRebaseBranch,
  handleMergeBranch,
}) => {
  const branchHeads = useMemo(
    () => (branchDoc ? JSON.stringify(A.getHeads(branchDoc)) : undefined),
    [branchDoc]
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  // compute new name suggestions anytime the branch heads change
  useEffect(() => {
    if (!dropdownOpen || !doc || !branchDoc) return;
    setNameSuggestions([]);
    (async () => {
      const suggestions = (
        await suggestBranchName({ doc, branchUrl, branchDoc })
      ).split("\n");
      setNameSuggestions(suggestions);
    })();
  }, [doc, branchDoc, branchUrl, branchHeads, dropdownOpen]);

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger>
        <MoreHorizontal
          size={18}
          className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mr-4 w-72">
        <DropdownMenuItem
          onClick={() => {
            const newName = prompt("Enter the new name for this branch:");
            if (newName && newName.trim() !== "") {
              handleRenameBranch(branchUrl, newName.trim());
            }
          }}
        >
          <Edit3Icon className="inline-block text-gray-500 mr-2" size={14} />{" "}
          Rename branch
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleRebaseBranch(branchUrl);
          }}
        >
          <GitBranchPlusIcon
            className="inline-block text-gray-500 mr-2"
            size={14}
          />{" "}
          Incorporate updates from main
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            handleMergeBranch(branchUrl);
          }}
        >
          <GitMergeIcon className="inline-block text-gray-500 mr-2" size={14} />{" "}
          Merge branch
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (
              window.confirm("Are you sure you want to delete this branch?")
            ) {
              handleDeleteBranch(branchUrl);
            }
          }}
        >
          <Trash2Icon className="inline-block text-gray-500 mr-2" size={14} />{" "}
          Delete branch
        </DropdownMenuItem>
        <DropdownMenuSeparator></DropdownMenuSeparator>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Suggested renames:</DropdownMenuLabel>
          {nameSuggestions.length === 0 && (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          )}
          {nameSuggestions.map((suggestion) => (
            <DropdownMenuItem
              key={suggestion}
              onClick={() => {
                handleRenameBranch(branchUrl, suggestion);
              }}
            >
              {suggestion}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
