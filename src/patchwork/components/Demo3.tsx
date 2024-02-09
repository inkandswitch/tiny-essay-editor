import { DiffWithProvenance, MarkdownDoc, Tag } from "@/tee/schema";
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
  HistoryIcon,
  MergeIcon,
  MilestoneIcon,
  MoreHorizontal,
  PlusIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";
import { diffWithProvenance, useActorIdToAuthorMap } from "../utils";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentAccount } from "@/DocExplorer/account";
import { getRelativeTimeString } from "@/DocExplorer/utils";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { Checkbox } from "@/components/ui/checkbox";
import { combinePatches } from "../utils";
import { BasicHistoryLog } from "./BasicHistoryLog";
import { Hash } from "./Hash";

type DocView =
  | { type: "main" }
  | {
      type: "branch";
      url: AutomergeUrl;
    };

interface CreateBranchOptions {
  name?: string;
  heads?: A.Heads;
}

export const Demo3: React.FC<{ docUrl: AutomergeUrl }> = ({ docUrl }) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const account = useCurrentAccount();

  const [sessionStartHeads, setSessionStartHeads] = useState<A.Heads>();
  const [isHoveringYankToBranchOption, setIsHoveringYankToBranchOption] =
    useState(false);
  const [showChangesFlag, setShowChangesFlag] = useState<boolean>(false);
  const [compareWithMainFlag, setCompareWithMainFlag] =
    useState<boolean>(false);

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

  const showDiff = showChangesFlag || isHoveringYankToBranchOption;

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

  const [selectedDocView, setSelectedDocView] = useState<DocView>({
    type: "main",
  });

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

  const createBranch = useCallback(
    ({ name, heads }: CreateBranchOptions = {}) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      const newHandle = repo.clone<MarkdownDoc>(docHandle);
      const draft = {
        name:
          name ?? `Branch #${(doc?.branchMetadata?.branches?.length ?? 0) + 1}`,
        createdAt: Date.now(),
        createdBy: account?.contactHandle?.url,
        url: newHandle.url,
      };

      // This is a terribly intricate dance because we store the draft metadata in the doc itself.
      // We need to make sure that the copyheads for the draft doc is set after the original doc has the new draft metadata.
      // We also need to merge the original handle into the draft after we update the draft metadata.
      // This can all be avoided by storing draft metadata outside of the document itself.

      docHandle.change((doc) => {
        doc.branchMetadata.branches.unshift(draft);
      });

      newHandle.merge(docHandle);

      newHandle.change((doc) => {
        doc.branchMetadata.source = {
          url: docUrl,
          branchHeads: heads ?? A.getHeads(docHandle.docSync()),
        };
      });
      setSelectedDocView({ type: "branch", url: newHandle.url });
      return newHandle.url;
    },
    [doc, docUrl, repo, account?.contactHandle?.url]
  );

  const moveCurrentChangesToBranch = () => {
    // todo: only pull in changes the author made themselves?
    createBranch({ heads: sessionStartHeads });

    // revert content of main to before edit session started
    const textAtMilestone = A.view(doc, sessionStartHeads).content;
    changeDoc((doc) => {
      A.updateText(doc, ["content"], textAtMilestone);
      setSessionStartHeads(A.getHeads(doc));
    });
    setIsHoveringYankToBranchOption(false);
  };

  const deleteBranch = useCallback(
    (draftUrl: AutomergeUrl) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.change((doc) => {
        const index = doc.branchMetadata.branches.findIndex(
          (copy) => copy.url === draftUrl
        );
        if (index !== -1) {
          doc.branchMetadata.branches.splice(index, 1);
        }
      });
    },
    [docUrl, repo]
  );

  const mergeBranch = useCallback(
    (draftUrl: AutomergeUrl) => {
      const draftHandle = repo.find<MarkdownDoc>(draftUrl);
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.merge(draftHandle);
      deleteBranch(draftUrl);
    },
    [deleteBranch, docUrl, repo]
  );

  const rebaseBranch = (draftUrl: AutomergeUrl) => {
    const draftHandle = repo.find<MarkdownDoc>(draftUrl);
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    draftHandle.merge(docHandle);
    draftHandle.change((doc) => {
      doc.branchMetadata.source.branchHeads = A.getHeads(docHandle.docSync());
    });
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
        }
      });
    },
    [docUrl, repo]
  );

  const createMilestone = () => {
    const heads = JSON.parse(JSON.stringify(A.getHeads(doc)));
    changeDoc((doc) => {
      if (!doc.tags) {
        doc.tags = [];
      }
      doc.tags.push({
        name: "Version #" + (doc.tags.length + 1),
        heads,
        createdAt: Date.now(),
        createdBy: account?.contactHandle?.url,
      });
    });
  };

  const renameMilestone = (heads: A.Heads, newName: string) => {
    changeDoc((doc) => {
      const milestone = doc.tags?.find((milestone) =>
        isEqual(milestone.heads, heads)
      );
      if (milestone) {
        milestone.name = newName;
      }
    });
  };

  const deleteMilestone = (heads: A.Heads) => {
    changeDoc((doc) => {
      const index = doc.tags.findIndex((milestone) =>
        isEqual(milestone.heads, heads)
      );
      if (index !== -1) {
        doc.tags.splice(index, 1);
      }
    });
  };

  const createBranchFromMilestone = (milestone: Tag) => {
    alert("This is a speculative feature, not implemented yet");
    // GL 2/7: not quite sure how this works... how do you clone at a heads?
  };

  const revertMainToMilestone = (milestone: Tag) => {
    const textAtMilestone = A.view(doc, milestone.heads).content;
    changeDoc((doc) => {
      A.updateText(doc, ["content"], textAtMilestone);
    });
    setSelectedDocView({ type: "main" });
  };

  const [selectedDraftDoc] = useDocument<MarkdownDoc>(
    selectedDocView.type === "branch" ? selectedDocView.url : undefined
  );

  const rawBranchDiff = useMemo(() => {
    if (selectedDraftDoc) {
      return diffWithProvenance(
        selectedDraftDoc,
        selectedDraftDoc.branchMetadata.source.branchHeads,
        A.getHeads(selectedDraftDoc)
      );
    }
  }, [selectedDraftDoc]);

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

  if (!doc || !doc.branchMetadata) return <div>Loading...</div>;

  const branches = doc.branchMetadata.branches ?? [];

  const selectedBranch =
    selectedDocView.type === "branch" &&
    branches.find((b) => selectedDocView.url === b.url);

  // The selected draft doesn't have the latest from the main document
  // if the copy head stored on it don't match the latest heads of the main doc.
  const selectedBranchNeedsRebase =
    selectedDraftDoc &&
    !isEqual(
      A.getHeads(doc),
      selectedDraftDoc.branchMetadata.source.branchHeads
    );

  const docHeads = docHeadsFromHistorySidebar ?? undefined;

  const activeMilestone = doc?.tags?.find((t) => isEqual(t.heads, docHeads));

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="flex h-full">
          <div className="flex-grow">
            <div className="bg-gray-50 pl-4 pt-6 pb-1 flex gap-2 items-center">
              <Select
                value={JSON.stringify(selectedDocView)}
                onValueChange={(value) => {
                  if (value === "__newDraft") {
                    createBranch();
                  } else if (value === "__moveChangesToDraft") {
                    moveCurrentChangesToBranch();
                  } else {
                    setSelectedDocView(JSON.parse(value as string));
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm w-[18rem] font-medium">
                  <SelectValue placeholder="Select Draft">
                    {selectedDocView.type === "main" && (
                      <div className="flex items-center gap-2">
                        <CrownIcon className="inline" size={12} />
                        Main
                      </div>
                    )}
                    {selectedDocView.type === "branch" && (
                      <div className="flex items-center gap-2">
                        <GitBranchIcon className="inline" size={12} />
                        {truncate(selectedBranch?.name, { length: 30 })}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-72">
                  <SelectItem
                    value={JSON.stringify({ type: "main" })}
                    className={
                      selectedDocView.type === "main" ? "font-medium" : ""
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

                    {branches.map((branch) => (
                      <SelectItem
                        key={branch.url}
                        className={`${
                          selectedBranch?.url === branch.url
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
                            <div>{getRelativeTimeString(branch.createdAt)}</div>
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
                      New Branch
                    </SelectItem>
                    {selectedDocView.type === "main" &&
                      currentEditSessionDiff &&
                      currentEditSessionDiff.patches.length > 0 && (
                        <SelectItem
                          value={"__moveChangesToDraft"}
                          key={"__moveChangesToDraft"}
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

              {selectedDocView.type === "branch" && (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <MoreHorizontal
                      size={18}
                      className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="mr-4">
                    <DropdownMenuItem
                      onClick={() => {
                        const newName = prompt(
                          "Enter the new name for this branch:"
                        );
                        if (newName && newName.trim() !== "") {
                          renameBranch(selectedBranch.url, newName.trim());
                        }
                      }}
                    >
                      <Edit3Icon
                        className="inline-block text-gray-500 mr-2"
                        size={14}
                      />{" "}
                      Rename Branch
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this branch?"
                          )
                        ) {
                          deleteBranch(selectedBranch.url);
                          setSelectedDocView({ type: "main" });
                        }
                      }}
                    >
                      <Trash2Icon
                        className="inline-block text-gray-500 mr-2"
                        size={14}
                      />{" "}
                      Delete Branch
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                  <Hash hash={diffForEditor.fromHeads[0] ?? ""} />
                  <div>to</div>
                  <Hash hash={diffForEditor.toHeads[0] ?? ""} />
                </div>
              )}

              <div className="flex items-center gap-1 text-sm font-medium text-gray-700 ">
                {selectedDocView.type === "branch" && (
                  <>
                    <Button
                      onClick={(e) => {
                        mergeBranch(selectedBranch.url);
                        setSelectedDocView({ type: "main" });
                        e.stopPropagation();
                      }}
                      variant="outline"
                      className="h-6"
                    >
                      <MergeIcon className="mr-2" size={12} />
                      Merge
                    </Button>
                    <Button
                      onClick={(e) => {
                        rebaseBranch(selectedBranch.url);
                      }}
                      variant="outline"
                      className="h-6 text-x"
                      disabled={!selectedBranchNeedsRebase}
                    >
                      Update from main
                    </Button>
                  </>
                )}
                {selectedDocView.type === "branch" && (
                  <div className="flex items-center">
                    <Checkbox
                      id="diff-overlay-checkbox"
                      className="mr-1"
                      checked={showChangesFlag}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        setShowChangesFlag(!showChangesFlag)
                      }
                    />
                    <label htmlFor="diff-overlay-checkbox">Show changes</label>
                  </div>
                )}

                {selectedDocView.type === "branch" && (
                  <div className="flex items-center">
                    <Checkbox
                      id="diff-overlay-checkbox"
                      className="mr-1"
                      checked={compareWithMainFlag}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() =>
                        setCompareWithMainFlag(!compareWithMainFlag)
                      }
                    />
                    <label htmlFor="diff-overlay-checkbox">
                      Compare with main
                    </label>
                  </div>
                )}
              </div>
              {!isHistorySidebarOpen && (
                <div
                  className={` ml-auto ${
                    isHistorySidebarOpen ? "mr-72" : "mr-4"
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
                      <HistoryIcon size={20} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-full items-stretch justify-stretch relative flex flex-col">
              {compareWithMainFlag && (
                <div className="w-full flex top-0 bg-gray-50 pt-4">
                  <div className="flex-1 pl-4">
                    <div className="inline-flex items-center gap-1">
                      <CrownIcon className="inline" size={12} /> main
                    </div>
                  </div>
                  <div className="flex-1 pl-4">{selectedBranch.name}</div>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="flex">
                  {selectedDocView.type === "branch" && compareWithMainFlag && (
                    <TinyEssayEditor
                      docUrl={docUrl}
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
                    docUrl={selectedBranch?.url ?? docUrl}
                    mainDocHandle={compareWithMainFlag ? handle : undefined}
                    docHeads={docHeads}
                    readOnly={docHeads && !isEqual(docHeads, A.getHeads(doc))}
                    key={`main-${docUrl}`}
                    diff={diffForEditor}
                    diffBase={diffBase}
                    showDiffAsComments
                    actorIdToAuthor={actorIdToAuthor}
                  />
                </div>
              </div>
            </div>
          </div>

          {isHistorySidebarOpen && (
            <div className=" bg-white border-l border-gray-200 p-2">
              <div className="flex gap-2 items-center text-sm font-semibold text-gray-600 pb-2 border-b border-gray-500">
                <div
                  onClick={() => setIsHistorySidebarOpen(false)}
                  className="p-2 cursor-pointer hover:bg-gray-100 border hover:border-gray-500 rounded-lg w-8"
                >
                  <ChevronsRight size={16} />
                </div>
                <HistoryIcon size={16} />
                History
              </div>

              <BasicHistoryLog
                docUrl={selectedBranch?.url ?? docUrl}
                setDocHeads={setDocHeadsFromHistorySidebar}
                setDiff={setDiffFromHistorySidebar}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
