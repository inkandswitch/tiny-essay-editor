import { Button } from "@/components/ui/button";
import {
  Comment,
  TextAnnotation,
  TextAnnotationWithPosition,
  MarkdownDoc,
  LivePatch,
  DraftAnnotation,
  PatchAnnotation,
  ThreadAnnotation,
  DiffWithProvenance,
} from "../schema";
import Haikunator from "haikunator";

import {
  Check,
  Fullscreen,
  MessageSquarePlus,
  PencilIcon,
  Reply,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, uuid } from "@automerge/automerge";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { useEffect, useState } from "react";
import { getRelativeTimeString, cmRangeToAMRange } from "../utils";
import { useCurrentAccount } from "@/DocExplorer/account";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { truncate } from "lodash";

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
  const addedComments: Array<{ threadId: string; commentIndex: number }> = (
    diff?.patches ?? []
  )
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
    if (!selection || selection.from === selection.to) {
      setSelectedAnnotationIds([]);
      return;
    }

    // find draft threads in selected range
    const highlightedPatchIds: string[] = [];
    annotationsWithPositions.forEach((annotation) => {
      if (
        annotation.from >= selection.from &&
        annotation.to <= selection.to &&
        annotation.type === "patch"
      ) {
        highlightedPatchIds.push(annotation.id);
      }
    });

    setSelectedAnnotationIds(highlightedPatchIds);
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

    const livePatches: LivePatch[] = selectedAnnotations
      .filter((annotation) => annotation.type === "patch")
      .map((annotation: PatchAnnotation) => ({
        fromCursor: annotation.fromCursor,
        toCursor: annotation.toCursor,
        fromHeads: annotation.fromHeads,
      }));

    // create new thread if all selected patches are virtual
    if (existingDrafts.length == 0) {
      const draft: DraftAnnotation = {
        type: "draft",
        title: new Haikunator().haikunate({ tokenLength: 0 }),
        id: uuid(),
        comments: [],
        livePatchesWithComments: livePatches.map((livePatch) => ({
          livePatch,
          comments: [],
        })),
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
        for (const livePatch of livePatches) {
          draft.livePatchesWithComments.push({
            livePatch,
            comments: [],
          });
        }
      });

      // give up if multiple non virtual change groups are selected
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
          const draft: DraftAnnotation = {
            type: "draft",
            title: new Haikunator().haikunate({ tokenLength: 0 }),
            id: uuid(),
            comments: [comment],
            livePatchesWithComments: [
              {
                livePatch: {
                  fromCursor: annotation.fromCursor,
                  toCursor: annotation.toCursor,
                  fromHeads: annotation.fromHeads,
                },
                comments: [],
              },
            ],
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

  const undoPatchesForThread = (annotation: TextAnnotation) => {
    if (annotation.type === "patch") {
      const patch = annotation.patch;
      const from = A.getCursorPosition(doc, ["content"], annotation.fromCursor);
      if (patch.action === "splice") {
        changeDoc((doc) => {
          A.splice(doc, ["content"], from, patch.value.length);
        });
      } else if (patch.action === "del") {
        alert("undoing deletions is not yet implemented");
      }
    } else if (annotation.type === "draft") {
      alert("Undo on drafts not implemented yet");
    }
  };

  const selectedThreadsThatContainEphemeralPatches = selectedAnnotationIds
    .map((id) =>
      annotationsWithPositions.find((annotation) => annotation.id === id)
    )
    .filter((thread) => thread && thread.type === "patch");

  // If there's a focused draft, show nothing for now
  // (TODO: show the comments for the parts of the diff...)
  if (focusedDraftThreadId) {
    return <div></div>;
  }

  return (
    <div>
      {selectedThreadsThatContainEphemeralPatches.length > 0 && (
        <div className="w-48 text-xs font-gray-600 p-2">
          {selectedThreadsThatContainEphemeralPatches.length} edits
          <Button
            variant="outline"
            className="h-6 ml-1"
            onClick={() => {
              const selectedThreads = selectedAnnotationIds.map((id) =>
                annotationsWithPositions.find((thread) => thread.id === id)
              );
              groupPatches(selectedThreads);
              setSelectedAnnotationIds([]);
            }}
          >
            Make draft
          </Button>
        </div>
      )}
      {annotationsWithPositions.map((annotation) => (
        <div
          key={annotation.id}
          className={`bg-white hover:border-gray-400 hover:bg-gray-50 p-4 mr-2 absolute border border-gray-300 rounded-sm max-w-lg transition-all duration-100 ease-in-out ${
            selectedAnnotationIds.includes(annotation.id)
              ? "z-50 shadow-sm border-gray-500 bg-blue-50 hover:bg-blue-50"
              : "z-0"
          }`}
          style={{
            top: annotation.yCoord,
          }}
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
            <div className="mb-3 border-b border-gray-300 pb-2 flex items-center text-gray-500">
              <div className="text-xs font-bold mb-1 uppercase mr-1">Draft</div>
              <div className="text-xs">{annotation.title}</div>
              <Button
                variant="outline"
                className="ml-2 h-5 max-w-24"
                onClick={() => setFocusedDraftThreadId(annotation.id)}
              >
                <Fullscreen className="mr-2 h-4" />
                Focus
              </Button>
            </div>
          )}
          {annotation.type === "draft" && (
            <div className="mb-3 border-b border-gray-300 pb-2">
              {annotation.livePatchesWithComments.map((livePatch) => (
                <div className="w-full font-mono">
                  <pre className="whitespace-pre-wrap text-xs text-gray-600">
                    {JSON.stringify(livePatch.livePatch, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
          {annotation.type === "patch" && (
            <div className="mb-3 border-b border-gray-300 pb-2">
              <div
                key={`${JSON.stringify(annotation.patch)}`}
                className="select-none"
              >
                {annotation.patch.action === "splice" && (
                  <div className="text-xs">
                    <strong>Insert: </strong>
                    <span className="font-serif">
                      {truncate(annotation.patch.value, { length: 50 })}
                    </span>
                  </div>
                )}
                {annotation.patch.action === "del" && (
                  <div className="text-xs">
                    <strong>Delete: </strong>
                    {annotation.patch.length} characters
                  </div>
                )}
                {!["splice", "del"].includes(annotation.patch.action) && (
                  <div className="font-mono">
                    Unknown action: {annotation.patch.action}
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            {(annotation.type === "thread" || annotation.type === "draft") &&
              annotation.comments.map((comment, index) => {
                const legacyUserName =
                  doc.users?.find((user) => user.id === comment.userId)?.name ??
                  "Anonymous";

                return (
                  <div
                    key={comment.id}
                    className={`mb-3 pb-3  rounded-md border-b border-b-gray-200 last:border-b-0 ${
                      addedComments.find(
                        (c) =>
                          c.threadId === annotation.id &&
                          c.commentIndex === index
                      ) &&
                      annotation.type === "thread" &&
                      "bg-green-100"
                    }`}
                  >
                    <div className="text-xs text-gray-600 mb-1 cursor-default flex items-center">
                      {comment.contactUrl ? (
                        <ContactAvatar
                          url={comment.contactUrl}
                          showName={true}
                          size="sm"
                        />
                      ) : (
                        legacyUserName
                      )}
                      <span className="ml-2 text-gray-400">
                        {getRelativeTimeString(comment.timestamp)}
                      </span>
                    </div>
                    <div className="cursor-default text-sm whitespace-pre-wrap mt-2">
                      {comment.content}
                    </div>
                  </div>
                );
              })}
          </div>
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
                {annotation.type === "patch" ? (
                  <Button className="mr-2" variant="outline">
                    <PencilIcon className="mr-2 " /> Explain
                  </Button>
                ) : (
                  <Button className="mr-2" variant="outline">
                    <Reply className="mr-2 " /> Reply
                  </Button>
                )}
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

            {annotation.type === "thread" && (
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
            )}

            {(annotation.type === "patch" || annotation.type === "draft") && (
              <Button
                variant="outline"
                className="select-none"
                onClick={() => undoPatchesForThread(annotation)}
              >
                <Check className="mr-2" /> Undo
              </Button>
            )}
          </div>
        </div>
      ))}
      <Popover
        open={commentBoxOpen}
        onOpenChange={() => setCommentBoxOpen((prev) => !prev)}
      >
        <PopoverTrigger asChild>
          {showCommentButton && (
            <Button
              className="relative shadow-md w-44"
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) + 23,
                left: -50,
              }}
            >
              <MessageSquarePlus size={24} className="mr-2" />
              Add comment
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
