import { DocType, toolsForDocTypes, docTypes } from "@/DocExplorer/doctypes";
import {
  DiffWithProvenance,
  EditRangeTarget,
  HasPatchworkMetadata,
  Annotation,
} from "../schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Button } from "@/components/ui/button";
import { truncate, sortBy } from "lodash";
import * as A from "@automerge/automerge/next";
import {
  ChevronsRight,
  CrownIcon,
  Edit3Icon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitMergeIcon,
  Link,
  MergeIcon,
  MessageSquareIcon,
  MoreHorizontal,
  PlusIcon,
  SplitIcon,
  Trash2Icon,
  Underline,
} from "lucide-react";
import {
  diffWithProvenance,
  doAnnotationsOverlap,
  useActorIdToAuthorMap,
} from "../utils";
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
import { combinePatches } from "../utils";
import { TimelineSidebar } from "./TimelineSidebar";
import {
  createBranch,
  deleteBranch,
  mergeBranch,
  suggestBranchName,
} from "../branches";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PositionMap,
  SpatialCommentsLinesLayer,
  SpatialSidebar,
} from "./SpatialSidebar";
import { useStaticCallback } from "@/tee/utils";
import { BotEditor } from "@/bots/BotEditor";
import {
  TLDraw,
  SideBySide as TLDrawSideBySide,
} from "@/tldraw/components/TLDraw";
import { DataGrid } from "@/datagrid/components/DataGrid";
import { DocEditorProps } from "@/DocExplorer/doctypes";
import { isMarkdownDoc } from "@/tee/datatype";
import { MarkdownDocAnchor } from "@/tee/schema";
import { AnnotationPosition } from "@/patchwork/schema";
import { isEqual } from "lodash";
import { isLLMActive } from "@/llm";

interface MakeBranchOptions {
  name?: string;
  heads?: A.Heads;
}

type ReviewMode = "comments" | "timeline";

/** A wrapper UI that renders a doc editor with a surrounding branch picker + timeline/annotations sidebar */
export const PatchworkDocEditor: React.FC<{
  docUrl: AutomergeUrl;
  docType: DocType;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
}> = ({ docUrl: mainDocUrl, docType, selectedBranch, setSelectedBranch }) => {
  const repo = useRepo();
  const [doc, changeDoc] =
    useDocument<HasPatchworkMetadata<unknown, unknown>>(mainDocUrl);
  const handle = useHandle<HasPatchworkMetadata<unknown, unknown>>(mainDocUrl);
  const account = useCurrentAccount();
  const [sessionStartHeads, setSessionStartHeads] = useState<A.Heads>();
  const [selection, setSelection] = useState<any>(); // todo: type properly
  const [hoveredAnnotation, setHoveredAnnotation] =
    useState<Annotation<unknown, unknown>>();
  const [selectedAnnotations, setSelectedAnnotations] = useState<
    Annotation<unknown, unknown>[]
  >([]);

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
  }, [JSON.stringify(selectedBranch)]);

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
      setSelectedBranch({ type: "main" });
      deleteBranch({ docHandle: handle, branchUrl });
      toast("Deleted branch");
    },
    [handle, setSelectedBranch]
  );

  const handleMergeBranch = useCallback(
    (branchUrl: AutomergeUrl) => {
      const branchHandle =
        repo.find<HasPatchworkMetadata<unknown, unknown>>(branchUrl);
      const docHandle =
        repo.find<HasPatchworkMetadata<unknown, unknown>>(mainDocUrl);
      mergeBranch({
        docHandle,
        branchHandle,
        mergedBy: account?.contactHandle?.url,
      });
      setSelectedBranch({ type: "main" });
      toast.success("Branch merged to main");
    },
    [repo, mainDocUrl, account?.contactHandle?.url, setSelectedBranch]
  );

  const rebaseBranch = (draftUrl: AutomergeUrl) => {
    const draftHandle =
      repo.find<HasPatchworkMetadata<unknown, unknown>>(draftUrl);
    const docHandle =
      repo.find<HasPatchworkMetadata<unknown, unknown>>(mainDocUrl);
    draftHandle.merge(docHandle);
    draftHandle.change((doc) => {
      doc.branchMetadata.source.branchHeads = A.getHeads(docHandle.docSync());
    });

    toast("Incorporated updates from main");
  };

  const renameBranch = useCallback(
    (draftUrl: AutomergeUrl, newName: string) => {
      const docHandle =
        repo.find<HasPatchworkMetadata<unknown, unknown>>(mainDocUrl);
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

  const selectedBranchUrl =
    selectedBranch.type === "branch" ? selectedBranch.url : undefined;
  const [branchDoc, changeBranchDoc] =
    useDocument<HasPatchworkMetadata<unknown, unknown>>(selectedBranchUrl);

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
    diffFromHistorySidebar ??
    (showDiff ? branchDiff ?? currentEditSessionDiff : undefined);

  const activeDoc = selectedBranchUrl ? branchDoc : doc;
  const activeChangeDoc = selectedBranchUrl ? changeBranchDoc : changeDoc;

  const annotations = useAnnotations({
    doc: activeDoc,
    docType,
    diff: diffForEditor,
  });

  const [reviewMode, setReviewMode] = useState<ReviewMode>("timeline");
  const [annotationPositions, setAnnotationPositions] = useState<
    AnnotationPosition<unknown, unknown>[]
  >([]);

  const [
    annotationsPositionsInSidebarMap,
    setAnnotationsPositionsInSidebarMap,
  ] = useState<PositionMap>();
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string>();

  const [hoveredDiscussionId, setHoveredDiscussionId] = useState<string>();
  const activeDiscussionIds = useMemo(() => {
    const ids = [];

    if (selectedDiscussionId) {
      ids.push(selectedDiscussionId);
    }

    if (hoveredDiscussionId) {
      ids.push(hoveredDiscussionId);
    }

    return ids;
  }, [selectedDiscussionId, hoveredDiscussionId]);

  const onUpdateAnnotationPositions = useStaticCallback((targetPositions) => {
    setAnnotationPositions(
      sortBy(
        targetPositions.map((position) => ({
          ...position,
          y: position.y,
          x: position.x,
        })),
        ({ y }) => y
      )
    );
  });

  // ---- ALL HOOKS MUST GO ABOVE THIS EARLY RETURN ----

  if (!doc || !docType || !doc.branchMetadata) return <div>Loading...</div>;

  // ---- ANYTHING RELYING ON doc SHOULD GO BELOW HERE ----

  const branches = doc.branchMetadata.branches ?? [];

  const selectedBranchLink =
    selectedBranch.type === "branch" &&
    branches.find((b) => selectedBranch.url === b.url);

  const docHeads = docHeadsFromHistorySidebar ?? undefined;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Branch picker topbar */}
        <div className="bg-gray-100 pl-4 pt-3 pb-3 flex gap-2 items-center border-b border-gray-200">
          <Select
            value={JSON.stringify(selectedBranch)}
            onValueChange={(value) => {
              if (value === "__newDraft") {
                handleCreateBranch();
              } else if (value === "__moveChangesToBranch") {
                moveCurrentChangesToBranch();
              } else {
                const selection = JSON.parse(value as string) as SelectedBranch;
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
                className={selectedBranch.type === "main" ? "font-medium" : ""}
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
                  Create new branch
                </SelectItem>
                {selectedBranch.type === "main" && (
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
                  onCheckedChange={() => setShowChangesFlag(!showChangesFlag)}
                />
                <label htmlFor="diff-overlay-checkbox">Highlight changes</label>
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
              className={` ml-auto ${isHistorySidebarOpen ? "mr-96" : "mr-4"}`}
            >
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
                  variant="outline"
                  className="h-8 text-x"
                >
                  <MessageSquareIcon size={20} />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Main doc editor pane */}
        <div className="flex-grow items-stretch justify-stretch relative flex flex-col overflow-hidden">
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
          <div className="flex-1 min-h-0 relative">
            {selectedBranch.type === "branch" && compareWithMainFlag ? (
              <SideBySide
                key={mainDocUrl}
                mainDocUrl={mainDocUrl}
                docType={docType}
                docUrl={selectedBranchLink?.url}
                docHeads={docHeads}
                annotations={annotations}
                actorIdToAuthor={actorIdToAuthor}
              />
            ) : (
              <DocEditor
                key={selectedBranchLink?.url ?? mainDocUrl}
                docType={docType}
                docUrl={selectedBranchLink?.url ?? mainDocUrl}
                docHeads={docHeads}
                annotations={annotations}
                actorIdToAuthor={actorIdToAuthor}
                onUpdateAnnotationPositions={onUpdateAnnotationPositions}
                selection={selection}
                setSelection={setSelection}
                selectedAnnotations={selectedAnnotations}
              />
            )}
            {reviewMode === "comments" && isHistorySidebarOpen && (
              <SpatialCommentsLinesLayer
                activeDiscussionIds={activeDiscussionIds}
                annotationsTargetPositions={annotationPositions}
                annotationsPositionsInSidebarMap={
                  annotationsPositionsInSidebarMap
                }
              />
            )}
          </div>
        </div>
      </div>

      {isHistorySidebarOpen && (
        <div className="border-l border-gray-200 py-2 h-full flex flex-col relative bg-gray-50">
          <div
            className="-left-[33px] absolute cursor-pointer hover:bg-gray-100 border hover:border-gray-500 rounded-lg w-[24px] h-[24px] grid place-items-center"
            onClick={() => setIsHistorySidebarOpen(false)}
          >
            <ChevronsRight size={16} />
          </div>

          <div className="px-2 pb-2 flex flex-col gap-2 text-sm font-semibold text-gray-600 border-b border-gray-200">
            <Tabs
              value={reviewMode}
              onValueChange={(value) => setReviewMode(value as ReviewMode)}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="min-h-0 flex-grow w-96">
            {reviewMode === "timeline" && (
              <TimelineSidebar
                // set key to trigger re-mount on branch change
                key={selectedBranchLink?.url ?? mainDocUrl}
                docType={docType}
                docUrl={selectedBranchLink?.url ?? mainDocUrl}
                setDocHeads={setDocHeadsFromHistorySidebar}
                setDiff={setDiffFromHistorySidebar}
                selectedBranch={selectedBranch}
                setSelectedBranch={setSelectedBranch}
              />
            )}
            {reviewMode === "comments" && (
              <SpatialSidebar
                selection={selection}
                resetSelection={() => setSelection(undefined)}
                docType={docType}
                annotations={annotationPositions.map(
                  ({ annotation }) => annotation
                )}
                changeDoc={activeChangeDoc}
                onChangeCommentPositionMap={(positions) => {
                  // todo: without this condition there is an infinite loop
                  if (!isEqual(positions, annotationsPositionsInSidebarMap)) {
                    setAnnotationsPositionsInSidebarMap(positions);
                  }
                }}
                setSelectedAnnotations={setSelectedAnnotations}
                selectedAnnotations={selectedAnnotations}
                setHoveredAnnotation={setHoveredAnnotation}
                hoveredAnnotation={hoveredAnnotation}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface DocEditorPropsWithDocType<T, V> extends DocEditorProps<T, V> {
  docType: DocType;
}

/* Wrapper component that dispatches to the tool for the doc type */
const DocEditor = <T, V>({
  docType,
  docUrl,
  docHeads,
  annotations,
  actorIdToAuthor,
  onUpdateAnnotationPositions,
  hoveredAnnotation,
  selectedAnnotations,
  setHoveredAnnotation,
  setSelectedAnnotations,
  selection,
  setSelection,
}: DocEditorPropsWithDocType<T, V>) => {
  // Currently we don't have a toolpicker so we just show the first tool for the doc type
  const Component = toolsForDocTypes[docType][0];

  return (
    <Component
      docUrl={docUrl}
      docHeads={docHeads}
      docType={docType}
      annotations={annotations as Annotation<MarkdownDocAnchor, string>[]}
      actorIdToAuthor={actorIdToAuthor}
      onUpdateAnnotationPositions={onUpdateAnnotationPositions}
      hoveredAnnotation={hoveredAnnotation}
      selectedAnnotations={selectedAnnotations}
      setHoveredAnnotation={setHoveredAnnotation}
      setSelectedAnnotations={setSelectedAnnotations}
      selection={selection}
      setSelection={setSelection}
    />
  );
};

export interface SideBySideProps<T, V> extends DocEditorPropsWithDocType<T, V> {
  mainDocUrl: AutomergeUrl;
}

export const SideBySide = <T, V>(props: SideBySideProps<T, V>) => {
  switch (props.docType) {
    case "tldraw": {
      return <TLDrawSideBySide {...props} />;
    }

    default: {
      const { mainDocUrl } = props;

      return (
        <div className="flex h-full w-full">
          <div className="h-full flex-1 overflow-auto">
            {
              <DocEditor
                {...props}
                docUrl={mainDocUrl}
                docHeads={undefined}
                annotations={[]}
              />
            }
          </div>
          <div className="h-full flex-1 overflow-auto">
            {<DocEditor {...props} />}
          </div>
        </div>
      );
    }
  }
};

const BranchActions: React.FC<{
  doc: HasPatchworkMetadata<unknown, unknown>;
  branchDoc: HasPatchworkMetadata<unknown, unknown>;
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

const useAnnotations = ({
  doc,
  docType,
  diff,
}: {
  doc: A.Doc<HasPatchworkMetadata<unknown, unknown>>;
  docType: DocType;
  diff?: DiffWithProvenance;
}) => {
  return useMemo(() => {
    if (!doc) {
      return [];
    }

    const patchesToAnnotations = docTypes[docType].patchesToAnnotations;
    const discussions = Object.values(doc?.discussions ?? []);

    // highlight annotations only exist in discussions, so we need to get them separately
    const highlightAnnotations = discussions.flatMap((discussion) =>
      discussion.resolved ||
      !discussion.annotation ||
      discussion.annotation.type !== "highlighted"
        ? []
        : [{ ...discussion.annotation, discussion }]
    );

    if (!diff) {
      return highlightAnnotations;
    }

    const editAnnotations = patchesToAnnotations
      ? patchesToAnnotations(
          doc,
          A.view(doc, diff.fromHeads),
          diff.patches as A.Patch[]
        ).flatMap((annotation) => {
          // match up annotations with discussions
          // it's possible that multiple discussions point to a single annotation (should occur rarely)
          const discussionsOnAnnotation = discussions.filter((discussion) =>
            doAnnotationsOverlap(discussion.annotation, annotation)
          );

          return discussionsOnAnnotation.length === 0
            ? [annotation]
            : discussionsOnAnnotation.map((discussion) => ({
                ...annotation,
                discussion,
              }));
        })
      : [];

    return editAnnotations.concat(highlightAnnotations);
  }, [doc, diff]);
};
