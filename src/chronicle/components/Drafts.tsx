import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useState } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { getRelativeTimeString } from "@/DocExplorer/utils";
import { isEqual, truncate } from "lodash";
import * as A from "@automerge/automerge/next";
import {
  DeleteIcon,
  EditIcon,
  MergeIcon,
  MoreHorizontal,
  PlusIcon,
  UsersIcon,
  VenetianMaskIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentAccount } from "@/DocExplorer/account";
import { diffWithProvenance } from "../utils";

export const DraftsPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [myPrivateDraftUrl, setMyPrivateDraftUrl] =
    useState<AutomergeUrl | null>(null);
  const [selectedDraftUrl, setSelectedDraftUrl] = useState<AutomergeUrl | null>(
    null
  );
  const [showDraftsSidebar, setShowDraftsSidebar] = useState<boolean>(true);
  const account = useCurrentAccount();
  const contactDoc = account?.contactHandle?.docSync();

  const createDraft = useCallback(
    (name: string = "Untitled Draft") => {
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      const newHandle = repo.clone<MarkdownDoc>(docHandle);

      // This is a terribly intricate dance because we store the draft metadata in the doc itself.
      // We need to make sure that the copyheads for the draft doc is set after the original doc has the new draft metadata.
      // We also need to merge the original handle into the draft after we update the draft metadata.
      // This can all be avoided by storing draft metadata outside of the document itself.

      docHandle.change((doc) => {
        doc.copyMetadata.copies.unshift({
          name,
          copyTimestamp: Date.now(),
          url: newHandle.url,
        });
      });

      newHandle.merge(docHandle);

      newHandle.change((doc) => {
        doc.copyMetadata.source = {
          url: docUrl,
          copyHeads: A.getHeads(docHandle.docSync()),
        };
      });
      setSelectedDraftUrl(newHandle.url);
      return newHandle.url;
    },
    [docUrl, repo]
  );

  const deleteDraft = useCallback(
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

  const mergeDraft = useCallback(
    (draftUrl: AutomergeUrl) => {
      const draftHandle = repo.find<MarkdownDoc>(draftUrl);
      const docHandle = repo.find<MarkdownDoc>(docUrl);
      docHandle.merge(draftHandle);
      deleteDraft(draftUrl);
    },
    [deleteDraft, docUrl, repo]
  );

  const rebaseDraft = (draftUrl: AutomergeUrl) => {
    const draftHandle = repo.find<MarkdownDoc>(draftUrl);
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    draftHandle.merge(docHandle);
    draftHandle.change((doc) => {
      doc.copyMetadata.source.copyHeads = A.getHeads(docHandle.docSync());
    });
  };

  const renameDraft = useCallback(
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

  // put handles on window for debug
  useEffect(() => {
    const docHandle = repo.find<MarkdownDoc>(docUrl);
    // @ts-expect-error window global debug
    window.docHandle = docHandle;

    if (!selectedDraftUrl) return;
    const selectedDraftHandle = repo.find<MarkdownDoc>(selectedDraftUrl);
    // @ts-expect-error window global debug
    window.draftHandle = selectedDraftHandle;

    // @ts-expect-error window global debug
    window.A = A;
  }, [selectedDraftUrl, docUrl]);
  const [selectedDraftDoc] = useDocument<MarkdownDoc>(selectedDraftUrl);
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

  const drafts = doc.copyMetadata.copies;

  // The selected draft doesn't have the latest from the main document
  // if the copy head stored on it don't match the latest heads of the main doc.
  const selectedDraftNeedsRebase =
    selectedDraftDoc &&
    !isEqual(A.getHeads(doc), selectedDraftDoc.copyMetadata.source.copyHeads);

  return (
    <div className="flex overflow-hidden h-full ">
      {showDraftsSidebar && (
        <div className="w-72 border-r border-gray-200 overflow-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
          <div>
            <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
              Main
            </div>

            <div className="overflow-y-auto flex-grow border-t border-gray-400 mb-2">
              <div
                className={`p-2 border-b border-gray-400 cursor-default ${
                  selectedDraftUrl === null ? "bg-blue-100" : ""
                }`}
                onClick={() => setSelectedDraftUrl(null)}
              >
                <div className="text-xs font-bold">Main Version</div>
              </div>
            </div>
          </div>

          <div className="">
            <div className="flex items-center mb-2">
              <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
                Drafts
              </div>

              <div className="ml-auto mr-1">
                <Button
                  className=""
                  variant="outline"
                  size="sm"
                  onClick={() => createDraft()}
                >
                  <PlusIcon className="mr-2" size={12} />
                  New draft
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto flex-grow border-t border-gray-400">
              {drafts.map((draft) => (
                <div
                  key={draft.url}
                  className={`p-2 border-b border-gray-400 cursor-default ${
                    draft.url === selectedDraftUrl ? "bg-blue-100" : ""
                  }`}
                  onClick={() => setSelectedDraftUrl(draft.url)}
                >
                  <div className="text-xs font-bold flex items-center">
                    <div>{draft.name}</div>
                    <div className="ml-auto mr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <MoreHorizontal
                            size={18}
                            className=" text-gray-500 hover:text-gray-800"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="mr-4">
                          <DropdownMenuItem
                            onClick={(e) => {
                              deleteDraft(draft.url);
                              setSelectedDraftUrl(null);
                              e.stopPropagation();
                            }}
                          >
                            <DeleteIcon className="mr-2" size={12} />
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              const newName = window.prompt("New name:");
                              if (newName) {
                                renameDraft(draft.url, newName);
                              }
                              e.stopPropagation();
                            }}
                          >
                            <EditIcon className="mr-2" size={12} />
                            Rename
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {truncate(draft.url, { length: 25 })}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    created {getRelativeTimeString(draft.copyTimestamp)}
                  </div>
                  <Button
                    onClick={(e) => {
                      mergeDraft(draft.url);
                      setSelectedDraftUrl(null);
                      e.stopPropagation();
                    }}
                    variant="outline"
                    className="h-6"
                  >
                    <MergeIcon className="mr-2" size={12} />
                    Merge
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="flex-grow overflow-hidden">
        <div className="p-2 h-10 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
          <div className="flex items-center">
            <div className="flex items-center">
              <input
                id="show-sidebar"
                type="checkbox"
                checked={showDraftsSidebar}
                onChange={(e) => setShowDraftsSidebar(e.target.checked)}
              />
              <label className="ml-2" htmlFor="show-sidebar">
                Show drafts list
              </label>
            </div>
            {selectedDraftUrl && (
              <div className="flex items-center">
                <div className="flex items-center">
                  <input
                    id="show-diff-overlay"
                    type="checkbox"
                    checked={showDiffOverlay}
                    onChange={(e) => setShowDiffOverlay(e.target.checked)}
                  />
                  <label className="ml-2" htmlFor="show-diff-overlay">
                    Show diff overlay
                  </label>
                </div>
                {selectedDraftNeedsRebase && (
                  <div className="ml-6 text-red-500 flex">
                    New changes on main
                    <div
                      className=" ml-2 text-xs text-gray-600 cursor-pointer hover:text-gray-800 border border-gray-400 px-1 rounded-md"
                      onClick={() => rebaseDraft(selectedDraftUrl)}
                    >
                      Update draft
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className={`ml-auto mr-2 flex items-center`}>
              {!myPrivateDraftUrl && (
                <Button
                  variant="outline"
                  className="h-6 text-xs font-semibold"
                  onClick={() => {
                    const draftUrl = createDraft(
                      `Private Session: ${
                        contactDoc?.type === "registered"
                          ? contactDoc.name
                          : "Unknown User"
                      }`
                    ); // todo put user's name in here
                    setMyPrivateDraftUrl(draftUrl);
                    setShowDiffOverlay(true);
                  }}
                >
                  <VenetianMaskIcon size={16} className="mr-1 inline" />
                  Start private session
                </Button>
              )}
              {myPrivateDraftUrl && (
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    className="h-6 text-xs font-semibold bg-purple-50 border-purple-400"
                    onClick={() => {
                      const confirm = window.confirm(
                        "OK to share your edits in the main version?"
                      );
                      if (!confirm) return;
                      mergeDraft(myPrivateDraftUrl);
                      setMyPrivateDraftUrl(null);
                      setSelectedDraftUrl(null);
                      setShowDiffOverlay(false);
                    }}
                  >
                    <UsersIcon size={16} className="mr-1 inline" />
                    End private session
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        <TinyEssayEditor
          docUrl={selectedDraftUrl || docUrl}
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
          diffStyle={
            selectedDraftUrl === myPrivateDraftUrl ? "private" : "normal"
          }
        />
      </div>
    </div>
  );
};
