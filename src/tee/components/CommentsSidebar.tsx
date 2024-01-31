import { Button } from "@/components/ui/button";
import {
  Comment,
  TextAnnotation,
  TextAnnotationWithPosition,
  MarkdownDoc,
  EditRange,
  DraftAnnotation,
  PatchAnnotation,
  ThreadAnnotation,
  DiffWithProvenance,
  PersistedDraft,
} from "../schema";

import { groupBy, uniq } from "lodash";
import { isValidAutomergeUrl } from "@automerge/automerge-repo";

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
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, uuid } from "@automerge/automerge";
import { PatchWithAttr } from "@automerge/automerge-wasm"; // todo: should be able to import this from @automerge/automerge directly

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { useEffect, useRef, useState } from "react";
import { getRelativeTimeString, cmRangeToAMRange } from "../utils";
import { ContactDoc, useCurrentAccount } from "@/DocExplorer/account";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { truncate } from "lodash";
import { useDocument } from "@/useDocumentVendored";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { ReadonlySnippetView } from "./ReadonlySnippetView";
import { getAttrOfPatch } from "@/chronicle/groupChanges";

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  annotationsWithPositions,
  selectedAnnotationIds,
  setSelectedThreadIds: setSelectedAnnotationIds,
  diff,
  focusedDraftThreadId,
  setFocusedDraftThreadId,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  annotationsWithPositions: TextAnnotationWithPosition[];
  selectedAnnotationIds: string[];
  setSelectedThreadIds: (threadIds: string[]) => void;
  focusedDraftThreadId: string | null;
  setFocusedDraftThreadId: (id: string | null) => void;
  diff?: DiffWithProvenance;
}) => {
  const account = useCurrentAccount();
  const [pendingCommentText, setPendingCommentText] = useState("");
  const [commentBoxOpen, setCommentBoxOpen] = useState(false);
  const [activeReplyThreadId, setActiveReplyThreadId] = useState<
    string | null
  >();

  // figure out which comments were added in the diff being shown, to highlight in green
  const addedComments = (diff?.patches ?? [])
    .filter(
      (patch) =>
        patch.path.length === 4 &&
        patch.path[0] === "commentThreads" &&
        patch.action === "insert"
    )
    .map((patch) => ({
      threadId: patch.path[1],
      commentIndex: patch.path[3],
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
    console.log(selection);
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
        }
        default: {
        }
      }
    });

    console.log(selectedAnnotationIds);

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
  const groupPatches = (selectedAnnotations: TextAnnotation[]) => {
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
      const draft: PersistedDraft = {
        type: "draft",
        id: uuid(),
        comments: [],
        fromHeads: selectedPatches[0].fromHeads,
        editRangesWithComments: editRanges.map((editRange) => ({
          editRange,
          comments: [],
        })),
        reviews: {},
        // TODO not concurrency safe
        number: Object.values(doc.drafts ?? {}).length + 1,
      };

      changeDoc((doc) => {
        // backwards compat for old docs without a drafts field
        if (doc.drafts === undefined) {
          doc.drafts = {};
        }
        doc.drafts[draft.id] = draft;
      });

      // add to existing thread if there is only one
    } else if (existingDrafts.length === 1) {
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

      // give up if multiple drafts are selected
    } else {
      alert("can't merge two groups");
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

    changeDoc((doc) => {
      switch (annotation.type) {
        case "thread": {
          const thread = doc.commentThreads[annotation.id];
          if (!thread) {
            throw new Error("expected thread to exist");
          }
          doc.commentThreads[annotation.id].comments.push(comment);
          return;
        }
        case "draft": {
          const draft = doc.drafts[annotation.id];
          if (!draft) {
            throw new Error("expected draft to exist");
          }
          doc.drafts[annotation.id].comments.push(comment);
          return;
        }
        case "patch": {
          // Make a draft for this patch
          const draft: PersistedDraft = {
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
          };

          // backwards compat for old docs without a drafts field
          if (doc.drafts === undefined) {
            doc.drafts = {};
          }
          doc.drafts[draft.id] = draft;
          return;
        }
      }
    });

    setPendingCommentText("");
  };

  const undoPatch = (patch: A.Patch) => {
    if (patch.action === "splice") {
      changeDoc((doc) => {
        A.splice(doc, ["content"], patch.path[1], patch.value.length);
      });
    } else if (patch.action === "del") {
      changeDoc((doc) => {
        A.splice(doc, ["content"], patch.path[1], 0, patch.removed);
      });
    }
  };

  const undoEditsFromAnnotation = (annotation: TextAnnotation) => {
    console.log("undo", annotation);
    if (annotation.type === "patch") {
      undoPatch(annotation.patch);
    } else if (annotation.type === "draft") {
      // Undoing multiple patches at once is a bit subtle!
      // If we use the numeric indexes on the patches, things get messed up.
      // So we gotta get cursors for the patches and then get numeric indexes
      // after each undo.

      const patchesWithCursors = annotation.editRangesWithComments
        .flatMap((range) => range.patches)
        .map((patch) => ({
          ...patch,
          fromCursor: A.getCursor(doc, ["content"], patch.path[1] as number),
        }));

      for (const patch of patchesWithCursors) {
        const adjustedIndex = A.getCursorPosition(
          doc,
          ["content"],
          patch.fromCursor
        );

        undoPatch({
          ...patch,
          path: [patch.path[0], adjustedIndex, ...patch.path.slice(2)],
        });
      }

      changeDoc((doc) => {
        delete doc.drafts[annotation.id];
      });
    }
  };

  const toggleAnnotationIsMarkedReviewed = (annotation: TextAnnotation) => {
    changeDoc((doc) => {
      let reviews = doc.drafts[annotation.id].reviews;
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

  const selectedAnnotations = selectedAnnotationIds.map((id) =>
    annotationsWithPositions.find((annotation) => annotation.id === id)
  );

  const selectedPatchAnnotations = selectedAnnotations.filter(
    (thread) => thread && thread.type === "patch"
  );

  const selectedDraftAnnotations = selectedAnnotations.filter(
    (thread) => thread && thread.type === "draft"
  );

  // If there's a focused draft, show nothing for now
  // (TODO: show the comments for the parts of the diff...)
  if (focusedDraftThreadId) {
    return <div></div>;
  }

  const showGroupingButton =
    selectedPatchAnnotations.length + selectedDraftAnnotations.length > 1 &&
    selectedDraftAnnotations.length <= 1;

  return (
    <div className="">
      <div className="group text-xs font-gray-600 p-2 ml-12 fixed top-[40vh] right-0 flex flex-row-reverse items-center z-[1000]">
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
        </div>
      </div>

      {annotationsWithPositions.map((annotation) => {
        const patchesForAnnotation =
          annotation.type === "draft"
            ? annotation.editRangesWithComments.flatMap(
                (range) => range.patches
              )
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
          annotation.reviews[account.contactHandle.url];
        return (
          <div
            key={annotation.id}
            className="absolute group"
            style={{
              top: annotation.yCoord,
            }}
          >
            <div className="flex items-start relative">
              <div
                className={`select-none mr-2 mb-1 rounded-sm max-w-lg transition-all duration-100 ease-in-out ${
                  selectedAnnotationIds.includes(annotation.id)
                    ? "z-50 shadow-sm ring-2 ring-blue-600"
                    : "z-0 "
                } ${
                  (annotation.type === "patch" ||
                    annotation.type === "thread") &&
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
                    annotation={annotation}
                    selected={selectedAnnotationIds.includes(annotation.id)}
                  />
                )}
                {annotation.type === "patch" && (
                  <Patch patch={annotation.patch} />
                )}
                <div>
                  {annotation.type === "thread" &&
                    annotation.comments.map((comment) => (
                      <div key={comment.id}>
                        <CommentView comment={comment} />
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-75 scale-75 -ml-4 -mt-1 ">
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
                <div className="ml-2 text-sm text-gray-500 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out cursor-pointer">
                  <Popover
                    open={activeReplyThreadId === annotation.id}
                    onOpenChange={(open) =>
                      open
                        ? setActiveReplyThreadId(annotation.id)
                        : setActiveReplyThreadId(null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <div className="flex mr-2 hover:text-gray-800">
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
                            replyToAnnotation(annotation);
                            setActiveReplyThreadId(null);
                            event.preventDefault();
                          }
                        }}
                      />

                      <PopoverClose>
                        <Button
                          variant="outline"
                          onClick={() => replyToAnnotation(annotation)}
                        >
                          Comment
                          <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                        </Button>
                      </PopoverClose>
                    </PopoverContent>
                  </Popover>

                  <div
                    className="flex hover:text-gray-800"
                    onClick={() => undoEditsFromAnnotation(annotation)}
                  >
                    <UndoIcon size={14} className="" />
                    Revert
                  </div>

                  <div
                    className="flex hover:text-gray-800"
                    onClick={() => toggleAnnotationIsMarkedReviewed(annotation)}
                  >
                    <CheckIcon size={14} className="" />
                    {isMarkedAsReviewed ? "Mark unreviewed" : "Mark reviewed"}
                  </div>
                </div>
              )}
              {annotation.type === "thread" && (
                <div className="mt-2">
                  <Popover
                    open={activeReplyThreadId === annotation.id}
                    onOpenChange={(open) =>
                      open
                        ? setActiveReplyThreadId(annotation.id)
                        : setActiveReplyThreadId(null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button className="mr-2" variant="outline">
                        <Reply className="mr-2 " /> Reply
                      </Button>
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
                            replyToAnnotation(annotation);
                            setActiveReplyThreadId(null);
                            event.preventDefault();
                          }
                        }}
                      />

                      <PopoverClose>
                        <Button
                          variant="outline"
                          onClick={() => replyToAnnotation(annotation)}
                        >
                          Comment
                          <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                        </Button>
                      </PopoverClose>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    className="select-none"
                    onClick={() =>
                      changeDoc(
                        (d) => (d.commentThreads[annotation.id].resolved = true)
                      )
                    }
                  >
                    <Check className="mr-2" /> Resolve
                  </Button>
                </div>
              )}
            </div>
          </div>
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

export const Patch = ({ patch }: { patch: A.Patch }) => {
  return (
    <div className="flex">
      {patch.action === "splice" && (
        <div className="text-sm">
          <span className="font-serif bg-green-50 border-b border-green-400">
            {truncate(patch.value, { length: 45 })}
          </span>
        </div>
      )}
      {patch.action === "del" && (
        <div className="text-sm">
          <span className="font-serif bg-red-50 border-b border-red-400">
            {truncate(patch.removed, { length: 45 })}
          </span>
        </div>
      )}
      {!["splice", "del"].includes(patch.action) && (
        <div className="font-mono">Unknown action: {patch.action}</div>
      )}
    </div>
  );
};

function CommentView({ comment }: { comment: Comment }) {
  const [contactDoc] = useDocument<ContactDoc>(comment.contactUrl);
  if (!contactDoc) return <div></div>;
  const name = contactDoc.type === "anonymous" ? "Anonymous" : contactDoc.name;
  return (
    <div>
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

        <div className="flex-0 text-gray-500">
          <MoreHorizontalIcon size={14} />
        </div>
      </div>

      <div className="p-1.5 pt-0">
        <p>{comment.content}</p>
      </div>
    </div>
  );
}

// A component for rendering a Draft (to be renamed Edit Group)
const Draft: React.FC<{ annotation: DraftAnnotation; selected: boolean }> = ({
  annotation,
  selected,
}) => {
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

  // State to track if the component is hovered
  const [isHovered, setIsHovered] = useState(false);

  const expanded = selected || isHovered;
  // Handlers for mouse enter and leave to manage hover state
  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const Icon = expanded ? FolderOpenIcon : FolderIcon;

  // Setting a manual height and width on this div is a hack.
  // The reason we do it is to make this div big enough to include the absolutely positioned children.
  // That in turn makes sure that we can capture scroll events.
  return (
    <div
      className={`pl-1 min-h-12 min-w-40 rounded-md ${
        expanded && "bg-black/50"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`flex text-xs items-center gap-1  ${
          expanded ? "text-white" : "text-gray-400"
        }`}
      >
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
                ? "z-50  mb-1 "
                : "z-0 absolute hover:bg-gray-50  hover:border-gray-400 "
            }`}
            style={
              // if group selected: a neat list
              expanded
                ? {}
                : {
                    // If group not selected: a messy stack in the z-axis
                    top: 21 + [0, 6, 2, 3, 5][index % 5],
                    left: [5, 1, 3, 3, 6][index % 5],
                    zIndex: index * -1,
                    transform: `rotate(${index % 2 === 0 ? 1.2 : -1.5}deg)`,
                  }
            }
          >
            <Patch patch={patch} />
          </div>
        ))}
      </div>

      {expanded && (
        <div>
          {annotation.comments.map((comment) => (
            <div key={comment.id} className={`${expanded && "text-white"}`}>
              <CommentView comment={comment} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
