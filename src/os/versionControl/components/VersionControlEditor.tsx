import { useCurrentAccount } from "@/os/explorer/account";
import { ContactAvatar } from "@/os/explorer/components/ContactAvatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@/os/explorer/components/ErrorFallback";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isMarkdownDoc } from "@/datatypes/markdown";
import { DATA_TYPES, DatatypeId } from "@/os/datatypes";
import { getRelativeTimeString } from "@/os/lib/dates";
import { isLLMActive } from "@/os/lib/llm";
import { EditorProps, TOOLS, Tool } from "@/os/tools";
import { SideBySide as TLDrawSideBySide } from "@/tools/tldraw/components/TLDraw";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";
import { isEqual, truncate } from "lodash";
import {
  ChevronsRight,
  CrownIcon,
  Edit3Icon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitMergeIcon,
  HistoryIcon,
  Link,
  MergeIcon,
  MessageSquareIcon,
  MoreHorizontal,
  PlusIcon,
  SplitIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAnnotations } from "../annotations";
import {
  createBranch,
  deleteBranch,
  mergeBranch,
  suggestBranchName,
} from "../branches";
import {
  Branch,
  DiffWithProvenance,
  HasVersionControlMetadata,
} from "../schema";
import {
  combinePatches,
  diffWithProvenance,
  useActorIdToAuthorMap,
} from "../utils";
import { PositionMap, ReviewSidebar } from "./ReviewSidebar";
import { TimelineSidebar } from "./TimelineSidebar";

interface MakeBranchOptions {
  name?: string;
  heads?: A.Heads;
}

type SidebarMode = "review" | "history";

/** A wrapper UI that renders a doc editor with a surrounding branch picker + timeline/annotations sidebar */
export const VersionControlEditor: React.FC<{
  docUrl: AutomergeUrl;
  datatypeId: DatatypeId;
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
}> = ({
  docUrl: mainDocUrl,
  datatypeId,
  selectedBranch,
  setSelectedBranch,
}) => {
  const repo = useRepo();
  const [doc, changeDoc] =
    useDocument<HasVersionControlMetadata<unknown, unknown>>(mainDocUrl);
  const handle =
    useHandle<HasVersionControlMetadata<unknown, unknown>>(mainDocUrl);
  const account = useCurrentAccount();
  const [sessionStartHeads, setSessionStartHeads] = useState<A.Heads>();

  const [isCommentInputFocused, setIsCommentInputFocused] = useState(false);

  const [isHoveringYankToBranchOption, setIsHoveringYankToBranchOption] =
    useState(false);
  const [showChangesFlag, setShowChangesFlag] = useState<boolean>(true);
  const [compareWithMainFlag, setCompareWithMainFlag] =
    useState<boolean>(false);
  // Reset compare view settings every time you switch branches
  useEffect(() => {
    if (!selectedBranch) {
      setCompareWithMainFlag(false);
      setShowChangesFlag(false);
    } else {
      setCompareWithMainFlag(false);
      setShowChangesFlag(true);
    }
  }, [JSON.stringify(selectedBranch)]);

  const [sidebarMode, _setSidebarMode] = useState<SidebarMode>();

  const setSidebarMode = (sidebarMode: SidebarMode) => {
    // reset state from history mode
    if (sidebarMode === "review" || !sidebarMode) {
      setDiffFromTimelineSidebar(undefined);
      setDocHeadsFromTimelineSidebar(undefined);
    }

    _setSidebarMode(sidebarMode);
  };

  const [diffFromTimelineSidebar, setDiffFromTimelineSidebar] =
    useState<DiffWithProvenance>();
  const [docHeadsFromTimelineSidebar, setDocHeadsFromTimelineSidebar] =
    useState<A.Heads>();

  useEffect(() => {
    if (!doc || sessionStartHeads) {
      return;
    }

    setSessionStartHeads(A.getHeads(doc));
  }, [doc, sessionStartHeads]);

  const currentEditSessionDiff = useMemo(() => {
    if (!doc || !sessionStartHeads || !isHoveringYankToBranchOption) {
      return undefined;
    }

    const diff = diffWithProvenance(doc, sessionStartHeads, A.getHeads(doc));

    // todo: generalize
    return {
      ...diff,
      patches: combinePatches(
        diff.patches.filter((patch) => patch.path[0] === "content")
      ),
    };
  }, [doc, sessionStartHeads, isHoveringYankToBranchOption]);

  const actorIdToAuthor = useActorIdToAuthorMap(mainDocUrl);

  const showDiff =
    (showChangesFlag && selectedBranch) || isHoveringYankToBranchOption;

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
      const branch = createBranch({
        repo,
        handle,
        name,
        heads,
        createdBy: account?.contactHandle?.url,
      });
      setSelectedBranch(branch);
      toast("Created a new branch");
      return repo.find(branch.url);
    },
    [repo, handle, account?.contactHandle?.url, setSelectedBranch]
  );

  const moveCurrentChangesToBranch = () => {
    if (!isMarkdownDoc(doc))
      throw new Error(
        "No content to move to branch; this only works for MarkdownDoc now"
      );

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
      setSelectedBranch(null);
      deleteBranch({ docHandle: handle, branchUrl });
      toast("Deleted branch");
    },
    [handle, setSelectedBranch]
  );

  const handleMergeBranch = useCallback(
    (branchUrl: AutomergeUrl) => {
      const branchHandle =
        repo.find<HasVersionControlMetadata<unknown, unknown>>(branchUrl);
      const docHandle =
        repo.find<HasVersionControlMetadata<unknown, unknown>>(mainDocUrl);
      mergeBranch({
        docHandle,
        branchHandle,
        mergedBy: account?.contactHandle?.url,
      });
      setSelectedBranch(null);
      toast.success("Branch merged to main");
    },
    [repo, mainDocUrl, account?.contactHandle?.url, setSelectedBranch]
  );

  const rebaseBranch = (draftUrl: AutomergeUrl) => {
    const draftHandle =
      repo.find<HasVersionControlMetadata<unknown, unknown>>(draftUrl);
    const docHandle =
      repo.find<HasVersionControlMetadata<unknown, unknown>>(mainDocUrl);
    draftHandle.merge(docHandle);
    draftHandle.change((doc) => {
      doc.branchMetadata.source.branchHeads = A.getHeads(docHandle.docSync());
    });

    toast("Incorporated updates from main");
  };

  const renameBranch = useCallback(
    (draftUrl: AutomergeUrl, newName: string) => {
      const docHandle =
        repo.find<HasVersionControlMetadata<unknown, unknown>>(mainDocUrl);
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
    [mainDocUrl, repo]
  );

  const [branchDoc, changeBranchDoc] = useDocument<
    HasVersionControlMetadata<unknown, unknown>
  >(selectedBranch?.url);
  const branchHandle = useHandle<HasVersionControlMetadata<unknown, unknown>>(
    selectedBranch?.url
  );

  const branchDiff = useMemo(() => {
    if (branchDoc) {
      return diffWithProvenance(
        branchDoc,
        branchDoc.branchMetadata.source.branchHeads,
        A.getHeads(branchDoc)
      );
    }
  }, [branchDoc]);

  const diffForEditor =
    diffFromTimelineSidebar ??
    (showDiff ? branchDiff ?? currentEditSessionDiff : undefined);

  const docHeads = docHeadsFromTimelineSidebar ?? undefined;
  const activeDoc = selectedBranch
    ? branchDoc
    : docHeads
    ? A.view(doc, docHeads)
    : doc;
  const activeHandle = selectedBranch ? branchHandle : handle;

  const {
    annotations,
    annotationGroups,
    selectedAnchors,
    setHoveredAnchor,
    setSelectedAnchors,
    setHoveredAnnotationGroupId,
    setSelectedAnnotationGroupId,
    setCommentState,
  } = useAnnotations({
    doc: activeDoc,
    datatypeId,
    diff: diffForEditor,
    isCommentInputFocused,
  });

  // For now we don't have a way for the user to pick a tool so we just pick the first one
  // In the future this will be selectable in the UI.
  const activeTool = TOOLS[datatypeId][0];

  // global comment keyboard shortcut
  // with cmd + shift + m a new comment is created
  const supportsInlineComments = activeTool.supportsInlineComments;

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.code === "KeyM"
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (!supportsInlineComments || selectedAnchors.length === 0) {
          setSidebarMode("review");
        }

        setCommentState({
          type: "create",
          target: selectedAnchors.length > 0 ? selectedAnchors : undefined,
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress, true);

    return () => {
      window.removeEventListener("keydown", handleKeyPress, true);
    };
  }, [selectedAnchors]);

  // ---- ALL HOOKS MUST GO ABOVE THIS EARLY RETURN ----

  if (!doc || !datatypeId || !doc.branchMetadata) return <div>Loading...</div>;

  // ---- ANYTHING RELYING ON doc SHOULD GO BELOW HERE ----

  const branches = doc.branchMetadata.branches ?? [];

  // Currently we can't filter out comments that didn't exist in a previous version of the document
  // this leads to seemingly random places in the document being highlighted. The problem is that
  // the cursor api doesn't provide a way to detect if the op was present it always gives the closest
  // position to that op in the current document.
  //
  // As a short term workaround we filter out all comments if the timeline sidebar is active
  const visibleAnnotations =
    sidebarMode === "history"
      ? annotations.filter((annotation) => annotation.type !== "highlighted")
      : annotations;

  // for now hide inline comments if side by side is enabled because there is not enought space
  const hideInlineComments = !!sidebarMode || compareWithMainFlag;

  const highlightSidebarButton =
    !sidebarMode &&
    annotations.some((a) => a.type === "highlighted" && a.isEmphasized) &&
    (!DATA_TYPES[datatypeId].supportsInlineComments || hideInlineComments);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Branch picker topbar */}
        <div className="bg-gray-100 pl-4 pt-3 pb-3 flex gap-2 items-center border-b border-gray-200">
          <Select
            value={selectedBranch?.url ?? "main"}
            onValueChange={(value) => {
              if (value === "__newBranch") {
                handleCreateBranch();
              } else if (value === "__moveChangesToBranch") {
                moveCurrentChangesToBranch();
              } else {
                const selectedBranchUrl = value as AutomergeUrl;
                const branch = doc.branchMetadata.branches.find(
                  (b) => b.url === selectedBranchUrl
                );

                setSelectedBranch(branch);

                if (branch) {
                  toast(`Switched to branch: ${branch.name}`);
                } else {
                  toast("Switched to Main");
                }
              }
            }}
          >
            <SelectTrigger className="h-8 text-sm w-[18rem] font-medium">
              <SelectValue>
                {selectedBranch ? (
                  <div className="flex items-center gap-2">
                    <GitBranchIcon className="inline" size={12} />
                    {truncate(selectedBranch.name, { length: 30 })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CrownIcon className="inline" size={12} />
                    Main
                  </div>
                )}{" "}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-72">
              <SelectItem
                value={null}
                className={!selectedBranch ? "font-medium" : ""}
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
                        selectedBranch?.url === branch.url ? "font-medium" : ""
                      }`}
                      value={branch.url}
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
                  value={"__newBranch"}
                  key={"__newBranch"}
                  className="font-regular"
                >
                  <PlusIcon className="inline mr-1" size={12} />
                  Create new branch
                </SelectItem>
                {!selectedBranch && isMarkdownDoc(doc) && (
                  <SelectItem
                    value={"__moveChangesToBranch"}
                    key={"__moveChangesToBranch"}
                    className="font-regular"
                    onMouseEnter={() => setIsHoveringYankToBranchOption(true)}
                    onMouseLeave={() => setIsHoveringYankToBranchOption(false)}
                  >
                    <SplitIcon className="inline mr-1" size={12} />
                    Move edits from this session to a new branch
                  </SelectItem>
                )}
              </SelectGroup>
            </SelectContent>
          </Select>

          {selectedBranch && (
            <BranchActions
              doc={doc}
              branchDoc={branchDoc}
              branchUrl={selectedBranch.url}
              handleDeleteBranch={handleDeleteBranch}
              handleRenameBranch={renameBranch}
              handleRebaseBranch={rebaseBranch}
              handleMergeBranch={handleMergeBranch}
            />
          )}

          <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
            {selectedBranch && (
              <div className="mr-2">
                <Button
                  onClick={(e) => {
                    handleMergeBranch(selectedBranch.url);
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
            {selectedBranch && (
              <div className="flex items-center mr-1">
                <Checkbox
                  id="diff-overlay-checkbox"
                  className="mr-1"
                  checked={showChangesFlag}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => setShowChangesFlag(!showChangesFlag)}
                />
                <label htmlFor="diff-overlay-checkbox">Highlight changes</label>
              </div>
            )}

            {selectedBranch && (
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

          {!sidebarMode && (
            <div className="ml-auto mr-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSidebarMode("review")}
                  variant="outline"
                  className={`h-8 text-x ${
                    highlightSidebarButton
                      ? "bg-yellow-200 hover:bg-yellow-400"
                      : ""
                  }`}
                >
                  <MessageSquareIcon size={20} />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main doc editor pane */}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="flex-grow items-stretch justify-stretch relative flex flex-col overflow-hidden">
            {compareWithMainFlag && selectedBranch && (
              <div className="w-full flex top-0 bg-gray-100 pt-4 text-sm font-medium">
                <div className="flex-1 pl-4">
                  <div className="inline-flex items-center gap-1">
                    <CrownIcon className="inline mr-1" size={12} /> Main
                  </div>
                </div>
                <div className="flex-1 pl-4">
                  {" "}
                  <GitBranchIcon className="inline mr-1" size={12} />
                  {selectedBranch.name}
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0 relative">
              {selectedBranch && compareWithMainFlag ? (
                <SideBySide
                  tool={activeTool}
                  key={mainDocUrl}
                  mainDocUrl={mainDocUrl}
                  docUrl={selectedBranch.url}
                  docHeads={docHeads}
                  annotations={visibleAnnotations}
                  annotationGroups={annotationGroups}
                  actorIdToAuthor={actorIdToAuthor}
                  setSelectedAnchors={setSelectedAnchors}
                  setHoveredAnchor={setHoveredAnchor}
                  setHoveredAnnotationGroupId={setHoveredAnnotationGroupId}
                  setSelectedAnnotationGroupId={setSelectedAnnotationGroupId}
                  hideInlineComments={hideInlineComments}
                  setCommentState={setCommentState}
                />
              ) : (
                <DocEditor
                  tool={activeTool}
                  key={selectedBranch?.url ?? mainDocUrl}
                  docUrl={selectedBranch?.url ?? mainDocUrl}
                  docHeads={docHeads}
                  annotations={visibleAnnotations}
                  annotationGroups={annotationGroups}
                  actorIdToAuthor={actorIdToAuthor}
                  setSelectedAnchors={setSelectedAnchors}
                  setHoveredAnchor={setHoveredAnchor}
                  setHoveredAnnotationGroupId={setHoveredAnnotationGroupId}
                  setSelectedAnnotationGroupId={setSelectedAnnotationGroupId}
                  hideInlineComments={hideInlineComments}
                  setCommentState={setCommentState}
                />
              )}
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {sidebarMode && (
        <div className="border-l border-gray-200 py-2 h-full flex flex-col relative bg-gray-50">
          <div
            className="-left-[33px] absolute cursor-pointer hover:bg-gray-100 border hover:border-gray-500 rounded-lg w-[24px] h-[24px] grid place-items-center"
            onClick={() => setSidebarMode(null)}
          >
            <ChevronsRight size={16} />
          </div>

          <div className="px-2 pb-2 flex flex-col gap-2 text-sm font-semibold text-gray-600 border-b border-gray-200">
            <Tabs
              value={sidebarMode}
              onValueChange={(mode) =>
                setSidebarMode(mode as "review" | "history")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="review">
                  <MessageSquareIcon size={16} className="mr-2" />
                  Review ({annotationGroups.length})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <HistoryIcon size={16} className="mr-2" />
                  History
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-grow w-96">
            {sidebarMode === "history" && (
              <TimelineSidebar
                // set key to trigger re-mount on branch change
                key={selectedBranch?.url ?? mainDocUrl}
                datatypeId={datatypeId}
                docUrl={selectedBranch?.url ?? mainDocUrl}
                setDocHeads={setDocHeadsFromTimelineSidebar}
                setDiff={setDiffFromTimelineSidebar}
                selectedBranch={selectedBranch}
                setSelectedBranch={setSelectedBranch}
              />
            )}
            {sidebarMode === "review" && (
              <ReviewSidebar
                doc={activeDoc}
                handle={activeHandle}
                datatypeId={datatypeId}
                annotationGroups={annotationGroups}
                selectedAnchors={selectedAnchors}
                setHoveredAnnotationGroupId={setHoveredAnnotationGroupId}
                setSelectedAnnotationGroupId={setSelectedAnnotationGroupId}
                isCommentInputFocused={isCommentInputFocused}
                setIsCommentInputFocused={setIsCommentInputFocused}
                setCommentState={setCommentState}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface EditorPropsWithTool<T, V> extends EditorProps<T, V> {
  tool: Tool;
}

/* Wrapper component that dispatches to the tool for the doc type */
const DocEditor = <T, V>({
  tool,
  docUrl,
  docHeads,
  annotations,
  annotationGroups,
  actorIdToAuthor,
  hideInlineComments,
  setSelectedAnchors,
  setHoveredAnchor,
  setSelectedAnnotationGroupId,
  setHoveredAnnotationGroupId,
  setCommentState,
}: EditorPropsWithTool<T, V>) => {
  // Currently we don't have a toolpicker so we just show the first tool for the doc type
  const Component = tool.editorComponent;

  return (
    <Component
      docUrl={docUrl}
      docHeads={docHeads}
      annotations={annotations}
      annotationGroups={annotationGroups}
      actorIdToAuthor={actorIdToAuthor}
      hideInlineComments={hideInlineComments}
      setSelectedAnchors={setSelectedAnchors}
      setHoveredAnchor={setHoveredAnchor}
      setSelectedAnnotationGroupId={setSelectedAnnotationGroupId}
      setHoveredAnnotationGroupId={setHoveredAnnotationGroupId}
      setCommentState={setCommentState}
    />
  );
};

export interface SideBySideProps<T, V> extends EditorPropsWithTool<T, V> {
  mainDocUrl: AutomergeUrl;
}

export const SideBySide = <T, V>(props: SideBySideProps<T, V>) => {
  // special side-by-side view for tldraw with scroll linking
  if (props.tool.id === "tldraw") {
    return <TLDrawSideBySide {...props} />;
  }

  const { mainDocUrl } = props;

  return (
    <div className="flex h-full w-full">
      <div className="h-full flex-1 overflow-auto bg-gray-200">
        {
          <DocEditor
            {...props}
            docUrl={mainDocUrl}
            docHeads={undefined}
            annotations={[]}
            annotationGroups={[]}
          />
        }
      </div>
      <div className="h-full flex-1 overflow-auto">
        {<DocEditor {...props} />}
      </div>
    </div>
  );
};

const BranchActions: React.FC<{
  doc: HasVersionControlMetadata<unknown, unknown>;
  branchDoc: HasVersionControlMetadata<unknown, unknown>;
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
  // todo: seems like this should run outside of the react UI...
  useEffect(() => {
    if (!dropdownOpen || !doc || !branchDoc) return;
    if (!isMarkdownDoc(doc) || !isMarkdownDoc(branchDoc)) {
      console.warn("suggestions only work for markdown docs");
      return;
    }
    if (!isLLMActive) return;
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
            navigator.clipboard.writeText(window.location.href).then(
              () => {
                toast("Link copied to clipboard");
              },
              () => {
                toast.error("Failed to copy link to clipboard");
              }
            );
          }}
        >
          <Link className="inline-block text-gray-500 mr-2" size={14} /> Copy
          link to branch
        </DropdownMenuItem>
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
        {isLLMActive && (
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
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
