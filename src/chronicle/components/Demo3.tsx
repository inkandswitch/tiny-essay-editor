import { Branch, MarkdownDoc, Tag } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { head, isEqual } from "lodash";
import * as A from "@automerge/automerge/next";
import {
  ChevronsLeftIcon,
  ChevronsRight,
  CrownIcon,
  Edit3Icon,
  GitBranchIcon,
  MergeIcon,
  MoreHorizontal,
  PlusIcon,
  SaveAllIcon,
  SaveIcon,
  Trash2Icon,
  UndoIcon,
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

type DocView =
  | { type: "main" }
  | {
      type: "branch";
      url: AutomergeUrl;
    }
  | {
      type: "snapshot";
      heads: A.Heads;
    };

export const Demo3: React.FC<{ docUrl: AutomergeUrl }> = ({ docUrl }) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const account = useCurrentAccount();

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
    (name?: string) => {
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
          branchHeads: A.getHeads(docHandle.docSync()),
        };
      });
      setSelectedDocView({ type: "branch", url: newHandle.url });
      return newHandle.url;
    },
    [doc, docUrl, repo, account?.contactHandle?.url]
  );

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

  const createSnapshot = () => {
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
    setSelectedDocView({ type: "snapshot", heads });
  };

  const renameSnapshot = (heads: A.Heads, newName: string) => {
    changeDoc((doc) => {
      const snapshot = doc.tags?.find((snapshot) =>
        isEqual(snapshot.heads, heads)
      );
      if (snapshot) {
        snapshot.name = newName;
      }
    });
  };

  const deleteSnapshot = (heads: A.Heads) => {
    changeDoc((doc) => {
      const index = doc.tags.findIndex((snapshot) =>
        isEqual(snapshot.heads, heads)
      );
      if (index !== -1) {
        doc.tags.splice(index, 1);
      }
    });
  };

  const createBranchFromSnapshot = (snapshot: Tag) => {
    alert("This is a speculative feature, not implemented yet");
    // GL 2/7: not quite sure how this works... how do you clone at a heads?
  };

  const revertMainToSnapshot = (snapshot: Tag) => {
    const textAtSnapshot = A.view(doc, snapshot.heads).content;
    changeDoc((doc) => {
      A.updateText(doc, ["content"], textAtSnapshot);
    });
    setSelectedDocView({ type: "main" });
  };

  const [selectedDraftDoc] = useDocument<MarkdownDoc>(
    selectedDocView.type === "branch" ? selectedDocView.url : undefined
  );
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(false);
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] =
    useState<boolean>(false);

  if (!doc || !doc.branchMetadata) return <div>Loading...</div>;

  const branches = doc.branchMetadata.branches ?? [];
  const snapshots = doc.tags ?? [];

  const selectedBranch =
    selectedDocView.type === "branch" &&
    branches.find((b) => selectedDocView.url === b.url);
  const selectedSnapshot =
    selectedDocView.type === "snapshot" &&
    snapshots.find((s) => isEqual(selectedDocView.heads, s.heads));

  // The selected draft doesn't have the latest from the main document
  // if the copy head stored on it don't match the latest heads of the main doc.
  const selectedBranchNeedsRebase =
    selectedDraftDoc &&
    !isEqual(
      A.getHeads(doc),
      selectedDraftDoc.branchMetadata.source.branchHeads
    );

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="flex">
          <div className="flex-grow">
            <div className="bg-gray-50 pl-8 pt-6 pb-1 flex gap-2 items-center">
              <Select
                value={JSON.stringify(selectedDocView)}
                onValueChange={(value) => {
                  if (value === "__newDraft") {
                    createBranch();
                  } else if (value === "__newSnapshot") {
                    createSnapshot();
                  } else {
                    setSelectedDocView(JSON.parse(value as string));
                  }
                }}
              >
                <SelectTrigger className="h-8 text-sm w-[160px]">
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
                        {selectedBranch?.name}
                      </div>
                    )}
                    {selectedDocView.type === "snapshot" && (
                      <div className="flex items-center gap-2">
                        <SaveIcon className="inline" size={12} />
                        {selectedSnapshot?.name}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-72">
                  <SelectItem value={JSON.stringify({ type: "main" })}>
                    <CrownIcon className="inline mr-1" size={12} />
                    Main
                  </SelectItem>
                  <SelectGroup>
                    <SelectLabel className="-ml-5">
                      <GitBranchIcon className="inline mr-1" size={12} />
                      Branches
                    </SelectLabel>

                    {branches.map((draft) => (
                      <SelectItem
                        key={draft.url}
                        value={JSON.stringify({
                          type: "branch",
                          url: draft.url,
                        })}
                      >
                        <div>{draft.name}</div>
                        <div className="ml-auto text-xs text-gray-600 flex gap-1">
                          {draft.createdAt && (
                            <div>{getRelativeTimeString(draft.createdAt)}</div>
                          )}
                          <span>by</span>
                          {draft.createdBy && (
                            <ContactAvatar
                              url={draft.createdBy}
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
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="-ml-5">
                      <SaveAllIcon className="inline mr-1" size={12} />
                      Snapshots
                    </SelectLabel>
                    {snapshots.map((snapshot) => (
                      <SelectItem
                        value={JSON.stringify({
                          type: "snapshot",
                          heads: snapshot.heads,
                        })}
                        key={snapshot.name}
                        className="font-regular"
                      >
                        {snapshot.name}

                        <div className="ml-auto text-xs text-gray-600 flex gap-1">
                          {snapshot.createdAt && (
                            <div>
                              {getRelativeTimeString(snapshot.createdAt)}
                            </div>
                          )}
                          <span>by</span>
                          {snapshot.createdBy && (
                            <ContactAvatar
                              url={snapshot.createdBy}
                              size="sm"
                              showName
                              showImage={false}
                            />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem
                      value={"__newSnapshot"}
                      key={"__newSnapshot"}
                      className="font-regular"
                    >
                      <PlusIcon className="inline mr-1" size={12} />
                      New Snapshot
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {selectedDocView.type === "snapshot" && (
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
                          renameSnapshot(
                            selectedSnapshot.heads,
                            newName.trim()
                          );
                        }
                      }}
                    >
                      <Edit3Icon
                        className="inline-block text-gray-500 mr-2"
                        size={14}
                      />{" "}
                      Rename Snapshot
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to delete this snapshot?"
                          )
                        ) {
                          deleteSnapshot(selectedSnapshot.heads);
                          setSelectedDocView({ type: "main" });
                        }
                      }}
                    >
                      <Trash2Icon
                        className="inline-block text-gray-500 mr-2"
                        size={14}
                      />{" "}
                      Delete Snapshot
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {selectedDocView.type === "snapshot" && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Button
                    onClick={() => revertMainToSnapshot(selectedSnapshot)}
                    variant="outline"
                    className="h-6"
                  >
                    <UndoIcon className="mr-2" size={12} />
                    Revert main to snapshot
                  </Button>
                  <Button
                    onClick={() => createBranchFromSnapshot(selectedSnapshot)}
                    variant="outline"
                    className="h-6"
                  >
                    <GitBranchIcon className="mr-2" size={12} />
                    Turn into branch
                  </Button>
                </div>
              )}
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

              {selectedDocView.type === "branch" && (
                <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
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

                  <Checkbox
                    id="diff-overlay-checkbox"
                    className="mr-1"
                    checked={showDiffOverlay}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => setShowDiffOverlay(!showDiffOverlay)}
                  />
                  <label htmlFor="diff-overlay-checkbox">Show changes</label>
                </div>
              )}
              {!isHistorySidebarOpen && (
                <div
                  className={` ml-auto ${
                    isHistorySidebarOpen ? "mr-72" : "mr-4"
                  }`}
                >
                  <div className="flex items-center">
                    <Button
                      onClick={() =>
                        setIsHistorySidebarOpen(!isHistorySidebarOpen)
                      }
                      variant="outline"
                      className="h-8 text-x"
                    >
                      <ChevronsLeftIcon size={20} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <TinyEssayEditor
              docUrl={selectedBranch?.url ?? docUrl}
              docHeads={selectedSnapshot?.heads ?? undefined}
              readOnly={selectedDocView.type === "snapshot"}
              key={docUrl}
              diff={
                showDiffOverlay && selectedDraftDoc
                  ? diffWithProvenance(
                      selectedDraftDoc,
                      selectedDraftDoc.branchMetadata.source.branchHeads,
                      A.getHeads(selectedDraftDoc)
                    )
                  : undefined
              }
              diffBase={
                showDiffOverlay && selectedDraftDoc
                  ? JSON.parse(
                      JSON.stringify(
                        selectedDraftDoc?.branchMetadata?.source.branchHeads
                      )
                    )
                  : undefined
              }
              showDiffAsComments
              actorIdToAuthor={actorIdToAuthor}
            />
          </div>

          {isHistorySidebarOpen && (
            <div className="w-72 bg-white border-l border-gray-200 p-2">
              <div
                onClick={() => setIsHistorySidebarOpen(false)}
                className="mb-4 p-2 cursor-pointer hover:bg-gray-50"
              >
                <ChevronsRight size={16} />
              </div>
              <div>History log goes here</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
