import { Branch, MarkdownDoc, Tag } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { isEqual } from "lodash";
import * as A from "@automerge/automerge/next";
import {
  Edit3Icon,
  GitBranchIcon,
  MergeIcon,
  MoreHorizontal,
  PlusIcon,
  SaveAllIcon,
  SaveIcon,
  SidebarCloseIcon,
  SidebarOpenIcon,
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

  const actorIdToAuthor = useActorIdToAuthorMap(docUrl);

  const [selectedDocView, setSelectedDocView] = useState<DocView>({
    type: "main",
  });

  const createDraft = useCallback(
    (name?: string) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      const newHandle = repo.clone<MarkdownDoc>(docHandle);
      const draft = {
        name: name ?? `Draft #${doc.copyMetadata.copies.length + 1}`,
        copyTimestamp: Date.now(),
        url: newHandle.url,
      };

      // This is a terribly intricate dance because we store the draft metadata in the doc itself.
      // We need to make sure that the copyheads for the draft doc is set after the original doc has the new draft metadata.
      // We also need to merge the original handle into the draft after we update the draft metadata.
      // This can all be avoided by storing draft metadata outside of the document itself.

      docHandle.change((doc) => {
        doc.copyMetadata.copies.unshift(draft);
      });

      newHandle.merge(docHandle);

      newHandle.change((doc) => {
        doc.copyMetadata.source = {
          url: docUrl,
          copyHeads: A.getHeads(docHandle.docSync()),
        };
      });
      setSelectedDocView({ type: "branch", url: newHandle.url });
      return newHandle.url;
    },
    [docUrl, repo]
  );

  const deleteBranch = useCallback(
    (draftUrl: AutomergeUrl) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.change((doc) => {
        const index = doc.copyMetadata.copies.findIndex(
          (copy) => copy.url === draftUrl
        );
        if (index !== -1) {
          doc.copyMetadata.copies.splice(index, 1);
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
      doc.copyMetadata.source.copyHeads = A.getHeads(docHandle.docSync());
    });
  };

  const createSnapshot = () => {
    changeDoc((doc) => {
      if (!doc.tags) {
        doc.tags = [];
      }
      doc.tags.push({
        name: window.prompt("Snapshot Name:"),
        heads: A.getHeads(doc),
      });
    });
  };

  const renameBranch = useCallback(
    (draftUrl: AutomergeUrl, newName: string) => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.change((doc) => {
        const copy = doc.copyMetadata.copies.find(
          (copy) => copy.url === draftUrl
        );
        if (copy) {
          copy.name = newName;
        }
      });
    },
    [docUrl, repo]
  );

  const [selectedDraftDoc] = useDocument<MarkdownDoc>(
    selectedDocView.type === "branch" ? selectedDocView.url : undefined
  );
  const [showDiffOverlay, setShowDiffOverlay] = useState<boolean>(false);

  if (!doc) return <div>Loading...</div>;
  if (!doc.copyMetadata)
    return (
      <div className="p-8">
        <div className="mb-2">
          This doc doesn't yet have the metadata needed for drafts, because it
          was created in older TEE.
        </div>
        <Button
          onClick={() =>
            changeDoc(
              (doc) =>
                (doc.copyMetadata = {
                  source: null,
                  copies: [],
                })
            )
          }
        >
          Initialize metadata
        </Button>
      </div>
    );

  const branches = doc.copyMetadata.copies;
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
    !isEqual(A.getHeads(doc), selectedDraftDoc.copyMetadata.source.copyHeads);

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="bg-gray-50 pl-8 pt-6 pb-1 flex gap-2 items-center">
          <Select
            value={JSON.stringify(selectedDocView)}
            onValueChange={(value) => {
              if (value === "__newDraft") {
                createDraft();
              } else if (value === "__newSnapshot") {
                createSnapshot();
              } else {
                setSelectedDocView(JSON.parse(value as string));
              }
            }}
          >
            <SelectTrigger className="h-8 text-sm w-[160px]">
              <SelectValue placeholder="Select Draft">
                {selectedDocView.type === "main" && "Main"}
                {selectedDocView.type === "branch" && selectedBranch?.name}
                {selectedDocView.type === "snapshot" && selectedSnapshot?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="-ml-5">
                  <GitBranchIcon className="inline mr-1" size={12} />
                  Branches
                </SelectLabel>
                <SelectItem value={JSON.stringify({ type: "main" })}>
                  Main
                </SelectItem>
                {branches.map((draft) => (
                  <SelectItem
                    key={draft.url}
                    value={JSON.stringify({ type: "branch", url: draft.url })}
                  >
                    {draft.name}
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
            <div className="flex items-center text-xs text-gray-500">
              <SaveIcon className="inline mr-1" size={12} />
              Readonly snapshot
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
            <div className="flex items-center gap-1">
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
            </div>
          )}
          <div className={` ml-auto ${showDiffOverlay ? "mr-72" : "mr-4"}`}>
            <div className="flex items-center">
              <Button
                onClick={() => setShowDiffOverlay(!showDiffOverlay)}
                variant="outline"
                className="h-6 text-x"
              >
                {/* These icons are confusingly flipped because our sidebar is on the right not the left. */}
                {!showDiffOverlay && <SidebarCloseIcon size={16} />}
                {showDiffOverlay && <SidebarOpenIcon size={16} />}
              </Button>
            </div>
          </div>
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
                  selectedDraftDoc.copyMetadata.source.copyHeads,
                  A.getHeads(selectedDraftDoc)
                )
              : undefined
          }
          diffBase={
            showDiffOverlay && selectedDraftDoc
              ? JSON.parse(
                  JSON.stringify(
                    selectedDraftDoc?.copyMetadata?.source.copyHeads
                  )
                )
              : undefined
          }
          showDiffAsComments
          actorIdToAuthor={actorIdToAuthor}
        />
      </div>
    </div>
  );
};
