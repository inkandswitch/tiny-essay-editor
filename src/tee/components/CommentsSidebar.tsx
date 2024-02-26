import { Button } from "@/components/ui/button";
import {
  Comment,
  TextAnnotation,
  TextAnnotationWithPosition,
  MarkdownDoc,
  DraftAnnotation,
  ThreadAnnotation,
  PersistedDraft,
  EditRange,
  PatchAnnotation,
} from "../schema";
import { DiffWithProvenance } from "@/patchwork/schema";

import { groupBy, uniq } from "lodash";
import { DocHandle, isValidAutomergeUrl } from "@automerge/automerge-repo";

import {
  Check,
  FolderIcon,
  FolderOpenIcon,
  GroupIcon,
  MessageCircleIcon,
  MessageSquarePlus,
  MoreHorizontalIcon,
  Reply,
  UndoIcon,
  CheckIcon,
  MergeIcon,
  ArrowRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, Doc, uuid } from "@automerge/automerge";
import { PatchWithAttr } from "@automerge/automerge-wasm"; // todo: should be able to import this from @automerge/automerge directly

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getRelativeTimeString,
  cmRangeToAMRange,
  ReviewStateFilter,
} from "../utils";
import { ContactDoc, useCurrentAccount } from "@/DocExplorer/account";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { truncate } from "lodash";
import { useDocument } from "@/useDocumentVendored";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { ReadonlySnippetView } from "./ReadonlySnippetView";
import { getAttrOfPatch } from "@/patchwork/groupPatches";
import { HistoryFilter } from "./HistoryFilter";
import { TextPatch, getCursorPositionSafely } from "@/patchwork/utils";
import { useHandle } from "@automerge/automerge-repo-react-hooks";
import { copyDocAtHeads } from "@/patchwork/utils";

const EXTEND_CHANGES_TO_WORD_BOUNDARIES = false; // @paul it doesn't quite work for deletes so I'm disabling it for now

export const CommentsSidebar = ({
  doc,
  changeDoc,
  handle,
  mainDocHandle,
  branchDocHandle,
  selection,
  annotationsWithPositions,
  selectedAnnotationIds,
  setSelectedAnnotationIds,
  diff,
  visibleAuthorsForEdits,
  setVisibleAuthorsForEdits,
  reviewStateFilter,
  setReviewStateFilter,
  authors,
  diffBase,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  handle: DocHandle<MarkdownDoc>;
  mainDocHandle?: DocHandle<MarkdownDoc>;
  branchDocHandle?: DocHandle<MarkdownDoc>;
  selection: TextSelection;
  annotationsWithPositions: TextAnnotationWithPosition[];
  selectedAnnotationIds: string[];
  setSelectedAnnotationIds: (threadIds: string[]) => void;
  diff?: DiffWithProvenance;
  visibleAuthorsForEdits: AutomergeUrl[];
  setVisibleAuthorsForEdits: (authors: AutomergeUrl[]) => void;
  reviewStateFilter: ReviewStateFilter;
  setReviewStateFilter: (filter: ReviewStateFilter) => void;
  authors: AutomergeUrl[];
  diffBase?: A.Heads;
}) => {
  const account = useCurrentAccount();
  const [pendingCommentText, setPendingCommentText] = useState("");
  const [commentBoxOpen, setCommentBoxOpen] = useState(false);
  const [activeReplyThreadId, setActiveReplyThreadId] = useState<
    string | null
  >();

  const prevDoc = useMemo(() => {
    if (!doc || !diffBase) {
      return;
    }

    return A.view(doc, diffBase);
  }, [doc, diffBase]);

  // figure out which comments were added in the diff being shown, to highlight in green
  const addedComments: { threadId: string; commentIndex: number }[] = (
    diff?.patches ?? []
  )
    .filter(
      (patch) =>
        patch.path.length === 4 &&
        patch.path[0] === "commentThreads" &&
        patch.action === "insert"
    )
    .map((patch) => ({
      threadId: patch.path[1] as string,
      commentIndex: patch.path[3] as number,
    }));

  // suppress showing the button immediately after adding a thread
  const [suppressButton, setSuppressButton] = useState(false);
  const showCommentButton =
    selection && selection.from !== selection.to && !suppressButton;

  // un-suppress the button once the selection changes
  useEffect(() => {
    setSuppressButton(false);
  }, [selection?.from, selection?.to]);

  // select patch threads if selection changes
  useEffect(() => {
    if (!selection) {
      setSelectedAnnotationIds([]);
      return;
    }

    // find draft threads in selected range
    const selectedAnnotationIds: string[] = [];
    annotationsWithPositions.forEach((annotation) => {
      switch (annotation.type) {
        case "patch": {
          if (
            !(annotation.to < selection.from || annotation.from > selection.to)
          ) {
            selectedAnnotationIds.push(annotation.id);
          }
          break;
        }
        case "draft": {
          for (const editRange of annotation.editRangesWithComments) {
            const from = A.getCursorPosition(
              doc,
              ["content"],
              editRange.editRange.fromCursor
            );
            const to = A.getCursorPosition(
              doc,
              ["content"],
              editRange.editRange.toCursor
            );
            if (!(to < selection.from || from > selection.to)) {
              selectedAnnotationIds.push(annotation.id);
              break;
            }
          }
          break;
        }
        default: {
          break;
        }
      }
    });

    setSelectedAnnotationIds(selectedAnnotationIds);
  }, [selection?.from, selection?.to]);

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const amRange = cmRangeToAMRange(selection);

    const fromCursor = A.getCursor(doc, ["content"], amRange.from);
    const toCursor = A.getCursor(doc, ["content"], amRange.to);

    const comment: Comment = {
      id: uuid(),
      content: commentText,
      userId: null,
      contactUrl: account?.contactHandle.url,
      timestamp: Date.now(),
    };

    const thread: ThreadAnnotation = {
      type: "thread",
      id: uuid(),
      comments: [comment],
      resolved: false,
      fromCursor,
      toCursor,
    };

    changeDoc((doc) => {
      doc.commentThreads[thread.id] = thread;
    });

    setPendingCommentText("");
  };

  // Start a draft for the selected patches
  const groupPatches = (
    selectedAnnotations: TextAnnotation[]
  ): string | undefined => {
    const existingDrafts: DraftAnnotation[] = selectedAnnotations.filter(
      (thread) => thread.type === "draft"
    ) as DraftAnnotation[];

    const selectedPatches = selectedAnnotations.filter(
      (annotation) => annotation.type === "patch"
    ) as PatchAnnotation[];

    if (selectedPatches.length === 0) {
      alert("no patches selected");
      return;
    }

    const editRanges: EditRange[] = selectedPatches.map(
      (annotation: PatchAnnotation) => ({
        fromCursor: annotation.fromCursor,
        toCursor: annotation.toCursor,
        fromHeads: annotation.fromHeads,
      })
    );

    // create new thread if all selected patches are virtual
    if (existingDrafts.length == 0) {
      const id = uuid();
      const draft: PersistedDraft = JSON.parse(
        JSON.stringify({
          type: "draft",
          id,
          comments: [],
          fromHeads: selectedPatches[0].fromHeads,
          editRangesWithComments: editRanges.map((editRange) => ({
            editRange,
            comments: [],
          })),
          reviews: {},
          // TODO not concurrency safe
          number: Object.values(doc.drafts ?? {}).length + 1,
        })
      );

      changeDoc((doc) => {
        // backwards compat for old docs without a drafts field
        if (doc.drafts === undefined) {
          doc.drafts = {};
        }
        doc.drafts[draft.id] = draft;
      });

      return id;
    }

    if (existingDrafts.length === 1) {
      const existingDraft = existingDrafts[0];
      changeDoc((doc) => {
        const draft = doc.drafts[existingDraft.id];
        for (const livePatch of editRanges) {
          draft.editRangesWithComments.push({
            editRange: livePatch,
            comments: [],
          });
        }
      });

      return existingDraft.id;
    }
  };

  // reply to a comment thread.
  const replyToAnnotation = (annotation: TextAnnotation) => {
    const comment: Comment = {
      id: uuid(),
      content: pendingCommentText,
      contactUrl: account?.contactHandle.url,
      timestamp: Date.now(),
    };

    switch (annotation.type) {
      case "thread": {
        const thread = doc.commentThreads[annotation.id];
        if (!thread) {
          throw new Error("expected thread to exist");
        }
        changeDoc((doc) => {
          doc.commentThreads[annotation.id].comments.push(comment);
        });
        break;
      }
      case "draft": {
        const draft = doc.drafts[annotation.id];
        if (!draft) {
          throw new Error("expected draft to exist");
        }
        changeDoc((doc) => {
          doc.drafts[annotation.id].comments.push(comment);
        });
        break;
      }
      case "patch": {
        // Make a draft for this patch
        const draft: PersistedDraft = JSON.parse(
          JSON.stringify({
            type: "draft",
            // TODO not concurrency safe
            number: Object.values(doc.drafts ?? {}).length + 1,
            id: uuid(),
            comments: [comment],
            fromHeads: annotation.fromHeads,
            editRangesWithComments: [
              {
                editRange: {
                  fromCursor: annotation.fromCursor,
                  toCursor: annotation.toCursor,
                },
                comments: [],
              },
            ],
            reviews: {},
          })
        );

        changeDoc((doc) => {
          // backwards compat for old docs without a drafts field
          if (doc.drafts === undefined) {
            doc.drafts = {};
          }
          doc.drafts[draft.id] = draft;
        });
        break;
      }
    }

    setPendingCommentText("");
  };

  const undoPatch = (patch: A.Patch | TextPatch) => {
    if (patch.action === "splice") {
      changeDoc((doc) => {
        A.splice(doc, ["content"], patch.path[1], patch.value.length);
      });
    } else if (patch.action === "del") {
      changeDoc((doc) => {
        A.splice(doc, ["content"], patch.path[1], 0, patch.removed);
      });
    } else if (patch.action === "replace") {
      undoPatch(patch.raw.delete);
      undoPatch(patch.raw.splice);
    }
  };

  const doPatchesEffect = (
    patches: (A.Patch | TextPatch)[],
    effect: (patch: A.Patch | TextPatch) => void
  ) => {
    const patchesWithCursors = patches.map((patch) => ({
      ...patch,
      fromCursor: A.getCursor(doc, ["content"], patch.path[1] as number),
    }));

    for (const patch of patchesWithCursors) {
      const adjustedIndex = A.getCursorPosition(
        doc,
        ["content"],
        patch.fromCursor
      );

      effect({
        ...patch,
        path: [patch.path[0], adjustedIndex, ...patch.path.slice(2)],
      });
    }
  };

  const undoEditsFromAnnotation = (annotation: TextAnnotation) => {
    if (annotation.type === "patch") {
      undoPatch(annotation.patch);
    } else if (annotation.type === "draft") {
      // Undoing multiple patches at once is a bit subtle!
      // If we use the numeric indexes on the patches, things get messed up.
      // So we gotta get cursors for the patches and then get numeric indexes
      // after each undo.

      doPatchesEffect(
        annotation.editRangesWithComments.flatMap((range) => range.patches),
        undoPatch
      );

      changeDoc((doc) => {
        delete doc.drafts[annotation.id];
      });
    }
  };

  const mergePatch = (patch: A.Patch | TextPatch) => {
    if ("raw" in patch) {
      const patches = [];

      if (patch.raw.delete) {
        patches.push(patch.raw.delete);
      }

      if (patch.raw.splice) {
        patches.push(patch.raw.splice);
      }

      doPatchesEffect(patches, mergePatch);
    } else if (patch.action === "splice") {
      const index = patch.path[1] as number;
      const spliceCursor = A.getCursor(doc, ["content"], index - 1);

      // insert change on main at the heads when this branch was forked of
      let newDiffBase = mainDocHandle.changeAt(
        handle.docSync().branchMetadata.source.branchHeads, // read branchHeads directly, diffBase might be stale
        (mainDoc) => {
          const spliceIndexInMain = getCursorPositionSafely(
            mainDoc,
            ["content"],
            spliceCursor
          );

          if (spliceIndexInMain !== null) {
            A.splice(
              mainDoc,
              ["content"],
              spliceIndexInMain + 1,
              0,
              patch.value
            );
          }
        }
      );

      handle.update((doc) =>
        A.merge(doc, copyDocAtHeads(mainDocHandle.docSync(), newDiffBase))
      );

      changeDoc((doc) => {
        A.splice(doc, ["content"], patch.path[1] as number, patch.value.length);
      });

      // update diff base of branch to include merged change in main
      changeDoc((doc) => {
        doc.branchMetadata.source.branchHeads = JSON.parse(
          JSON.stringify(newDiffBase)
        );
      });
    } else if (patch.action === "del") {
      let index = patch.path[1] as number;
      let spliceCursor: A.Cursor;
      const mainDoc = mainDocHandle.docSync();

      // this is bad, incrementally move the cursor backwards until we are at a character that exists in the main doc
      do {
        index -= 1;
        spliceCursor = A.getCursor(doc, ["content"], index);
      } while (
        index > 0 &&
        getCursorPositionSafely(mainDoc, ["content"], spliceCursor) === null
      );

      // apply delete on main at the heads when this branch was forked of
      const newDiffBase = mainDocHandle.changeAt(
        handle.docSync().branchMetadata.source.branchHeads, // read branchHeads directly, diffBase might be stale
        (mainDoc) => {
          const spliceIndexInMain = getCursorPositionSafely(
            mainDoc,
            ["content"],
            spliceCursor
          );

          if (spliceIndexInMain !== null) {
            A.splice(mainDoc, ["content"], spliceIndexInMain + 1, patch.length);
          }
        }
      );

      // update diff base of branch to include merged change in main
      changeDoc((doc) => {
        doc.branchMetadata.source.branchHeads = JSON.parse(
          JSON.stringify(newDiffBase)
        );
      });
    }
  };

  const mergeEditsFromAnnotation = (annotation: TextAnnotation) => {
    if (annotation.type === "patch") {
      mergePatch(annotation.patch);
    } else if (annotation.type === "draft") {
      // Undoing multiple patches at once is a bit subtle!
      // If we use the numeric indexes on the patches, things get messed up.
      // So we gotta get cursors for the patches and then get numeric indexes
      // after each undo.

      for (const patch of annotation.editRangesWithComments.flatMap(
        (range) => range.patches
      )) {
        mergePatch(patch);
      }

      changeDoc((doc) => {
        delete doc.drafts[annotation.id];
      });
    }
  };

  const moveEditsToBranch = (annotation: TextAnnotation) => {
    alert("not implemented yet");
  };

  const toggleAnnotationIsMarkedReviewed = (annotation: TextAnnotation) => {
    let draftId: string;

    if (annotation.type === "patch") {
      draftId = groupPatches([annotation]);
    } else {
      draftId = annotation.id;
    }

    changeDoc((doc) => {
      let reviews = doc.drafts[draftId]?.reviews;
      if (!reviews) {
        doc.drafts[annotation.id].reviews = {};
        reviews = doc.drafts[annotation.id].reviews;
      }

      if (reviews[account.contactHandle.url]) {
        delete reviews[account.contactHandle.url];
      } else {
        reviews[account.contactHandle.url] = A.getHeads(doc);
      }
    });
  };

  const resolveThread = (annotation: TextAnnotationWithPosition) => {
    changeDoc((d) => (d.commentThreads[annotation.id].resolved = true));
  };

  const selectedAnnotations = selectedAnnotationIds.map((id) =>
    annotationsWithPositions.find((annotation) => annotation.id === id)
  );

  const selectedPatchAnnotations = selectedAnnotations.filter(
    (thread) => thread && thread.type === "patch"
  );

  const selectedDraftAnnotations = selectedAnnotations.filter(
    (thread) => thread && thread.type === "draft"
  );

  const showGroupingButton =
    selectedPatchAnnotations.length + selectedDraftAnnotations.length > 0 &&
    selectedDraftAnnotations.length <= 1;

  return (
    <div className="w-72">
      {diff && (
        <div className="mt-4 z-[1000] relative ">
          <HistoryFilter
            visibleAuthorsForEdits={visibleAuthorsForEdits}
            setVisibleAuthorsForEdits={setVisibleAuthorsForEdits}
            reviewStateFilter={reviewStateFilter}
            setReviewStateFilter={setReviewStateFilter}
            authors={authors}
          />
        </div>
      )}
      {
        // hide edit group buttons for now
        /*<div className="fixed top-[40vh] right-0 z-[1000]">
       <div className="group text-xs font-gray-600 p-2 ml-12 flex flex-row-reverse items-center z-[1000]">
          <Button
            variant="outline"
            disabled={!showGroupingButton}
            className="group-hover:flex group-hover:items-center group-hover:justify-center h-8 ml-1 bg-black/80 backdrop-blur text-white rounded-full px-0 hover:bg-black/90 hover:text-white"
            onClick={() => {
              const selectedThreads = selectedAnnotationIds.map((id) =>
                annotationsWithPositions.find((thread) => thread.id === id)
              );
              groupPatches(selectedThreads);
              setSelectedAnnotationIds([]);
            }}
          >
            <GroupIcon className="inline m-1" />
          </Button>
          <div
            className={`transition-opacity duration-100 ease-in-out opacity-0 ${
              showGroupingButton
                ? "group-hover:opacity-100"
                : "group-hover:opacity-50"
            }`}
          >
            Group
            <span className="ml-1 text-gray-400">(⌘-G)</span>
          </div>
          </div>
        <div className="group text-xs font-gray-600 p-2 ml-12 flex flex-row-reverse items-center z-[1000]">
          <Button
            variant="outline"
            disabled={!showGroupingButton}
            className="group-hover:flex group-hover:items-center group-hover:justify-center h-8 ml-1 bg-black/80 backdrop-blur text-white rounded-full px-0 hover:bg-black/90 hover:text-white"
            onClick={() => {
              const selectedAnnotations = selectedAnnotationIds.map((id) =>
                annotationsWithPositions.find((thread) => thread.id === id)
              );
              const patches = selectedAnnotations.flatMap((annotation) => {
                if (annotation.type === "patch") {
                  return [annotation.patch];
                }
                if (annotation.type === "draft") {
                  return annotation.editRangesWithComments.flatMap(
                    (range) => range.patches
                  );
                } else {
                  return [];
                }
              });

              doPatchesEffect(patches, undoPatch);
            }}
          >
            <UndoIcon className="inline m-1" />
          </Button>
          <div
            className={`transition-opacity duration-100 ease-in-out opacity-0 ${
              showGroupingButton
                ? "group-hover:opacity-100"
                : "group-hover:opacity-50"
            }`}
          >
            Revert
          </div>
        </div>
      </div>*/
      }

      {annotationsWithPositions.map((annotation) => {
        return (
          <TextAnnotationView
            key={annotation.id}
            doc={doc}
            prevDoc={prevDoc}
            annotation={annotation}
            contactUrl={account.contactHandle.url}
            selectedAnnotationIds={selectedAnnotationIds}
            setSelectedAnnotationIds={setSelectedAnnotationIds}
            activeReplyThreadId={activeReplyThreadId}
            setActiveReplyThreadId={setActiveReplyThreadId}
            pendingCommentText={pendingCommentText}
            setPendingCommentText={setPendingCommentText}
            replyToAnnotation={() => replyToAnnotation(annotation)}
            undoEditsFromAnnotation={() => undoEditsFromAnnotation(annotation)}
            mergeEditsFromAnnotation={
              mainDocHandle
                ? () => mergeEditsFromAnnotation(annotation)
                : undefined
            }
            moveEditsToBranch={
              branchDocHandle ? () => moveEditsToBranch(annotation) : undefined
            }
            toggleAnnotationIsMarkedReviewed={() =>
              toggleAnnotationIsMarkedReviewed(annotation)
            }
            resolveThread={() => resolveThread(annotation)}
            addedComments={addedComments}
          />
        );
      })}

      <Popover
        open={commentBoxOpen}
        onOpenChange={() => setCommentBoxOpen((prev) => !prev)}
      >
        <PopoverTrigger asChild>
          {showCommentButton && (
            <Button
              className="relative shadow-md ml-2 p-2 rounded-full"
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) + 23,
                left: -50,
              }}
            >
              <MessageSquarePlus size={24} className="" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent>
          <Textarea
            className="mb-4"
            value={pendingCommentText}
            onChange={(event) => setPendingCommentText(event.target.value)}
            // GL Nov: figure out how to close the popover upon cmd-enter submit
            // GL 12/14: the answer here is going to be to control Popover open
            // state ourselves as we now do elsewhere in the codebase
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.metaKey) {
                startCommentThreadAtSelection(pendingCommentText);
                setSuppressButton(true);
                setCommentBoxOpen(false);
                event.preventDefault();
              }
            }}
          />

          <PopoverClose>
            <Button
              variant="outline"
              onClick={() => {
                startCommentThreadAtSelection(pendingCommentText);
                setSuppressButton(true);
              }}
            >
              Comment
              <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
            </Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const getSentenceFromPatch = (
  text: string,
  patch: A.SpliceTextPatch | A.DelPatch
): Sentence => {
  const from = patch.path[1] as number;
  const length = patch.action === "splice" ? patch.value.length : 0;
  const to = from + length;

  const start =
    Math.max(text.lastIndexOf(".", from), text.lastIndexOf("\n", from)) + 1;
  const end = Math.min(text.indexOf(".", to), text.indexOf("\n", to));
  return { text: text.slice(start, end).trim(), offset: start, patches: [] };
};

interface Sentence {
  offset: number;
  text: string;
  patches: A.Patch[];
}

const groupPatchesBySentence = (text: string, patches: A.Patch[]) => {
  const filteredPatches = patches.filter(
    (patch) => patch.action === "splice" || patch.action === "del"
  ) as (A.SpliceTextPatch | A.DelPatch)[];
  const sentences: Sentence[] = [];

  for (const patch of filteredPatches) {
    const sentence = getSentenceFromPatch(text, patch);
    const existingSentence = sentences.find(
      (s) => s.offset === sentence.offset && s.text === sentence.text
    );
    const offsetPatch = {
      ...patch,
      path: ["content", (patch.path[1] as number) - sentence.offset],
    };

    if (existingSentence) {
      existingSentence.patches.push(offsetPatch);
    } else {
      sentence.patches.push(offsetPatch);
      sentences.push(sentence);
    }
  }

  return sentences;
};

export const PatchesGroupedBySentence = ({
  text,
  patches,
}: {
  text: string;
  patches: A.Patch[];
}) => {
  return (
    <div className="text-xs mx-[-10px]">
      {groupPatchesBySentence(text, patches).map((sentence) => {
        return (
          <ReadonlySnippetView
            text={sentence.text}
            patches={sentence.patches}
            setSelection={() => {}}
          />
        );
      })}
    </div>
  );
};

export const PatchesGroupedByAuthor = ({
  patches,
}: {
  patches: PatchWithAttr<AutomergeUrl>[];
}) => {
  const patchesByAuthor = groupBy(
    patches,
    (patch: PatchWithAttr<AutomergeUrl>) => getAttrOfPatch(patch)
  );

  return (
    <div className="text-xs">
      {Object.entries(patchesByAuthor).map(([author, patches]) => (
        <div key={author}>
          <div className="text-xs text-gray-600 mb-1 cursor-default flex items-center">
            <ContactAvatar
              url={
                isValidAutomergeUrl(author as AutomergeUrl)
                  ? (author as AutomergeUrl)
                  : undefined
              }
              size="sm"
              showName
            />
          </div>
          {patches.map((patch, index) => (
            <Patch patch={patch} key={index} />
          ))}
        </div>
      ))}
    </div>
  );
};

interface AnnotationViewProps {
  doc: MarkdownDoc;
  prevDoc: MarkdownDoc;
  annotation: TextAnnotationWithPosition;
  contactUrl: AutomergeUrl;
  selectedAnnotationIds: string[];
  setSelectedAnnotationIds: (threadIds: string[]) => void;
  activeReplyThreadId: string;
  setActiveReplyThreadId: (threadId: string) => void;
  pendingCommentText: string;
  setPendingCommentText: (text: string) => void;
  replyToAnnotation: () => void;
  undoEditsFromAnnotation: () => void;
  toggleAnnotationIsMarkedReviewed: () => void;
  mergeEditsFromAnnotation?: () => void;
  moveEditsToBranch?: () => void;
  resolveThread: () => void;
  addedComments: { threadId: string; commentIndex: number }[];
}

export const TextAnnotationView = ({
  doc,
  prevDoc,
  annotation,
  contactUrl,
  selectedAnnotationIds,
  setSelectedAnnotationIds,
  activeReplyThreadId,
  setActiveReplyThreadId,
  pendingCommentText,
  setPendingCommentText,
  replyToAnnotation,
  undoEditsFromAnnotation,
  toggleAnnotationIsMarkedReviewed,
  mergeEditsFromAnnotation,
  moveEditsToBranch,
  resolveThread,
  addedComments,
}: AnnotationViewProps) => {
  const patchesForAnnotation =
    annotation.type === "draft"
      ? annotation.editRangesWithComments.flatMap((range) => range.patches)
      : annotation.type === "patch"
      ? [annotation.patch]
      : [];
  const authors = uniq(
    patchesForAnnotation
      .map((patch) => getAttrOfPatch(patch))
      .filter((attr) => isValidAutomergeUrl(attr))
  ) as AutomergeUrl[];

  // todo: check if the edit hasn't changed since the last time the user marked it reviewed
  const isMarkedAsReviewed =
    "reviews" in annotation &&
    annotation.reviews &&
    annotation.reviews[contactUrl];

  // State to track if the component is hovered
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="absolute group transition-all duration-100 ease-in-out select-none"
      style={{
        top: annotation.yCoord,
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <div className="flex flex-col items-start relative">
        <div
          className={` mr-2 rounded-sm max-w-lg  ${
            selectedAnnotationIds.includes(annotation.id) &&
            "z-50 shadow-sm ring-2 ring-blue-600"
          } ${
            (annotation.type === "patch" || annotation.type === "thread") &&
            "px-2 py-1 bg-white border border-gray-200"
          }`}
          onClick={(e) => {
            if (e.shiftKey) {
              setSelectedAnnotationIds([
                ...selectedAnnotationIds,
                annotation.id,
              ]);
            } else {
              setSelectedAnnotationIds([annotation.id]);
            }
            e.stopPropagation();
          }}
        >
          {annotation.type === "draft" && (
            <Draft
              isHovered={isHovered}
              currentText={doc.content}
              prevText={prevDoc.content}
              annotation={annotation}
              selected={selectedAnnotationIds.includes(annotation.id)}
            />
          )}
          {annotation.type === "patch" && (
            <div className="z-0">
              <Patch
                patch={annotation.patch}
                currentText={doc.content}
                prevText={prevDoc.content}
              />
            </div>
          )}
          <div>
            {annotation.type === "thread" &&
              annotation.comments.map((comment, index) => (
                <div key={comment.id}>
                  <CommentView
                    comment={comment}
                    highlightDiff={addedComments.some(
                      (c) =>
                        c.threadId === annotation.id && c.commentIndex === index
                    )}
                  />
                </div>
              ))}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-75 scale-75 -ml-4 ">
          {authors.map((author) => (
            <ContactAvatar
              url={author}
              showName={false}
              size="sm"
              key={author}
            />
          ))}
        </div>
        {(annotation.type === "draft" || annotation.type === "patch") && (
          <div
            className={`ml-2 text-sm pt-1 text-gray-500 flex flex-col gap-1 transition-opacity duration-300 ease-in-out cursor-pointer ${
              isHovered ? "opacity-100 z-50" : "opacity-0"
            }`}
          >
            <Popover
              open={activeReplyThreadId === annotation.id}
              onOpenChange={(open) =>
                open
                  ? setActiveReplyThreadId(annotation.id)
                  : setActiveReplyThreadId(null)
              }
            >
              <PopoverTrigger asChild>
                <div className="flex hover:text-gray-800 items-center gap-2">
                  <MessageCircleIcon size={14} className="" />
                  Comment
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <Textarea
                  className="mb-4"
                  value={pendingCommentText}
                  onChange={(event) =>
                    setPendingCommentText(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.metaKey) {
                      replyToAnnotation();
                      setActiveReplyThreadId(null);
                      event.preventDefault();
                    }
                  }}
                />

                <PopoverClose>
                  <Button variant="outline" onClick={() => replyToAnnotation()}>
                    Comment
                    <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>

            <div
              className="flex hover:text-gray-800 gap-2 items-center"
              onClick={() => undoEditsFromAnnotation()}
            >
              <UndoIcon size={14} className="" />
              Revert
            </div>

            <div
              className="flex hover:text-gray-800 gap-2 items-center"
              onClick={() => toggleAnnotationIsMarkedReviewed()}
            >
              <CheckIcon size={14} className="" />
              {isMarkedAsReviewed ? "Mark unreviewed" : "Mark reviewed"}
            </div>

            {mergeEditsFromAnnotation && (
              <div
                className="flex hover:text-gray-800 gap-2 items-center"
                onClick={() => mergeEditsFromAnnotation()}
              >
                <MergeIcon size={14} className="" />
                Merge
              </div>
            )}

            {moveEditsToBranch && (
              <div
                className="flex hover:text-gray-800 gap-2 items-center"
                onClick={() => moveEditsToBranch()}
              >
                <ArrowRight size={14} className="" />
                Move edits to branch
              </div>
            )}
          </div>
        )}
      </div>
      {annotation.type === "thread" && (
        <div className="mt-1">
          <Popover
            open={activeReplyThreadId === annotation.id}
            onOpenChange={(open) =>
              open
                ? setActiveReplyThreadId(annotation.id)
                : setActiveReplyThreadId(null)
            }
          >
            <PopoverTrigger asChild>
              <Button className="mr-2 px-2 h-8" variant="outline">
                <Reply className="mr-2 " /> Reply
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Textarea
                className="mb-4"
                value={pendingCommentText}
                onChange={(event) => setPendingCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.metaKey) {
                    replyToAnnotation();
                    setActiveReplyThreadId(null);
                    event.preventDefault();
                  }
                }}
              />

              <PopoverClose>
                <Button variant="outline" onClick={() => replyToAnnotation()}>
                  Comment
                  <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                </Button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            className="select-none h-8 px-2"
            onClick={() => resolveThread()}
          >
            <Check className="mr-2" /> Resolve
          </Button>
        </div>
      )}
    </div>
  );
};

export const Patch = ({
  patch,
  currentText,
  prevText,
}: {
  patch: A.Patch | TextPatch;
  currentText?: string;
  prevText?: string;
}) => {
  return (
    <div className="flex">
      {patch.action === "splice" && (
        <div className="text-sm">
          <span className="font-serif bg-green-50 border-b border-green-400">
            {patchToString(patch, currentText)}
          </span>
        </div>
      )}
      {patch.action === "del" && (
        <div className="text-sm">
          <span className="font-serif bg-red-50 border-b border-red-400">
            {patchToString(patch, prevText)}
          </span>
        </div>
      )}
      {patch.action === "replace" && (
        <div className="text-sm">
          <span className="font-serif bg-red-50 border-b border-red-400">
            {patchToString(patch.raw.delete, prevText)}
          </span>{" "}
          →{" "}
          <span className="font-serif bg-green-50 border-b border-green-400">
            {patchToString(patch.raw.splice, currentText)}
          </span>
        </div>
      )}
      {!["splice", "del", "replace"].includes(patch.action) && (
        <div className="font-mono">Unknown action: {patch.action}</div>
      )}
    </div>
  );
};

function patchToString(patch: A.Patch | TextPatch, text: string) {
  if (EXTEND_CHANGES_TO_WORD_BOUNDARIES) {
    switch (patch.action) {
      case "del": {
        const from = patch.path[1] as number;
        const to = from + patch.length;

        // todo: figure out cursors
        return truncate(patch.removed, { length: 45 });
      }
      case "splice": {
        const from = patch.path[1] as number;
        const to = from + patch.value.length;

        return truncate(extractWord(text, from, to), { length: 1045000 });
      }

      default:
        throw new Error("invalid patch");
    }
  }

  switch (patch.action) {
    case "del": {
      return truncate(patch.removed, { length: 45 });
    }
    case "splice": {
      return truncate(patch.value, { length: 45 });
    }

    default:
      throw new Error("invalid patch");
  }
}

function extractWord(text: string, from: number, to: number) {
  const value = text.slice(from, to);

  // special case single punctuation changes
  if (isPunctuation(value)) {
    return value;
  }

  // Expand the 'to' index to include the whole word
  let start = from;
  let end = to;

  // Expand backwards to the start of the word
  while (
    start > 0 &&
    text[start - 1] !== " " &&
    text[start - 1] !== "\n" &&
    !isPunctuation(text[start - 1])
  ) {
    start--;
  }

  // Expand forwards to the end of the word
  while (end < text.length && text[end] !== " " && !isPunctuation(text[end])) {
    end++;
  }

  // Return the word
  return text.substring(start, end);
}

const PUNCTUATION_REGEX = /[!\"#$%&'()*+,-./:;<=>?@\[\\\]^_`{|}~“”]/;

function isPunctuation(value: string) {
  return PUNCTUATION_REGEX.test(value);
}

export function CommentView({
  comment,
  highlightDiff,
}: {
  comment: Comment;
  highlightDiff?: boolean;
}) {
  const [contactDoc] = useDocument<ContactDoc>(comment.contactUrl);
  if (!contactDoc) return <div></div>;
  const name = contactDoc.type === "anonymous" ? "Anonymous" : contactDoc.name;
  return (
    <div className={highlightDiff ? "bg-green-100" : ""}>
      <div className="flex items-center gap-1.5 p-1.5 text-sm">
        <div className="flex-0">
          <ContactAvatar url={comment.contactUrl} showName={false} size="sm" />
        </div>

        <div className="flex-1">
          <div className="font-bold">{name}</div>
          <div className="text-xs text-gray-400">
            {getRelativeTimeString(comment.timestamp)}
          </div>
        </div>
      </div>

      <div className="p-1.5 pt-0 text-sm">
        <p>{comment.content}</p>
      </div>
    </div>
  );
}

function CompactCommentView({ comment }: { comment: Comment }) {
  const [contactDoc] = useDocument<ContactDoc>(comment.contactUrl);
  if (!contactDoc) return <div></div>;
  const name = contactDoc.type === "anonymous" ? "Anonymous" : contactDoc.name;
  return (
    <div className="text-xs">
      <div className="flex items-center">
        <div className="flex-0 scale-75">
          <ContactAvatar url={comment.contactUrl} showName={false} size="sm" />
        </div>

        <div className="flex-1">
          <div className="font-medium">{name}</div>
        </div>
      </div>

      <div className="p-1.5 pt-0">
        <p>{comment.content}</p>
      </div>
    </div>
  );
}

// A component for rendering a Draft (to be renamed Edit Group)
const Draft: React.FC<{
  annotation: DraftAnnotation;
  selected: boolean;
  currentText: string;
  prevText: string;
  isHovered: boolean;
}> = ({ annotation, selected, currentText, prevText, isHovered }) => {
  const account = useCurrentAccount();

  // todo: check if the edit hasn't changed since the last time the user marked it reviewed

  const isMarkedAsReviewedByAnyone =
    "reviews" in annotation &&
    annotation.reviews &&
    Object.values(annotation.reviews).length > 0;

  const isMarkedAsReviewedByMe =
    isMarkedAsReviewedByAnyone &&
    account &&
    annotation.reviews[account.contactHandle.url];

  const patches = annotation.editRangesWithComments.flatMap(
    (range) => range.patches
  );

  const expanded = selected || isHovered;

  const Icon = expanded ? FolderOpenIcon : FolderIcon;

  const firstComment = annotation.comments[0];

  // Setting a manual height and width on this div is a hack.
  // The reason we do it is to make this div big enough to include the absolutely positioned children.
  // That in turn makes sure that we can capture scroll events.
  return (
    <div
      className={`p-2 min-h-12 min-w-48 rounded-md  border border-gray-200 bg-white shadow ${
        expanded && " border border-gray-300 z-50 relative"
      }`}
    >
      <div className={`flex text-xs items-center gap-1 text-gray-400`}>
        <Icon size={12} className="inline-block " /> {patches.length} edits
        {annotation.comments.length > 0 &&
          ` · ${annotation.comments.length} comments`}
        {isMarkedAsReviewedByAnyone && (
          <Check
            className={isMarkedAsReviewedByMe ? "text-green-500" : ""}
            size={16}
          />
        )}
      </div>

      <div className="p-1">
        {patches.map((patch, index) => (
          <div
            key={JSON.stringify(patch)}
            className={`select-none mr-2 px-2 py-1 w-48 bg-white  border border-gray-200 rounded-sm max-w-lg transition-all duration-100 ease-in-out  ${
              expanded
                ? "z-50  mb-1 relative"
                : "z-0 absolute hover:bg-gray-50  hover:border-gray-400 "
            }`}
            style={
              // if group selected: a neat list
              expanded
                ? {}
                : {
                    // If group not selected: a messy stack in the z-axis
                    top: 28 + [0, 6, 2, 3, 5][index % 5],
                    left: 5 + [5, 1, 3, 3, 6][index % 5],
                    zIndex: index * -1,
                    transform: `rotate(${index % 2 === 0 ? 1.2 : -1.5}deg)`,
                  }
            }
          >
            <Patch
              patch={patch}
              currentText={currentText}
              prevText={prevText}
            />
          </div>
        ))}
      </div>

      {/* Preview first comment in collapsed state */}
      {firstComment && !expanded && (
        <div className="mt-8 max-w-64">
          <CompactCommentView comment={firstComment} />
        </div>
      )}

      {annotation.comments.length > 1 && !expanded && (
        <div className="text-gray-500 text-xs">
          +{annotation.comments.length - 1} more
        </div>
      )}

      {expanded && (
        <div>
          {annotation.comments.map((comment) => (
            <div key={comment.id}>
              <CommentView comment={comment} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
