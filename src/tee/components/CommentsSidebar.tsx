import { Button } from "@/components/ui/button";
import {
  Comment,
  CommentThread,
  CommentThreadWithPosition,
  MarkdownDoc,
} from "../schema";
import Haikunator from "haikunator";

import {
  Check,
  Fullscreen,
  MessageSquarePlus,
  PencilIcon,
  Reply,
  ShrinkIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, Patch, uuid } from "@automerge/automerge";

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
  threadsWithPositions,
  selectedThreadIds,
  setSelectedThreadIds,
  diff,
  focusedDraftThreadId,
  setFocusedDraftThreadId,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  threadsWithPositions: CommentThreadWithPosition[];
  selectedThreadIds: string[];
  setSelectedThreadIds: (threadIds: string[]) => void;
  focusedDraftThreadId: string | null;
  setFocusedDraftThreadId: (id: string | null) => void;
  diff?: Patch[];
}) => {
  const account = useCurrentAccount();
  const [pendingCommentText, setPendingCommentText] = useState("");
  const [commentBoxOpen, setCommentBoxOpen] = useState(false);
  const [activeReplyThreadId, setActiveReplyThreadId] = useState<
    string | null
  >();

  // figure out which comments were added in the diff being shown, to highlight in green
  const addedComments: Array<{ threadId: string; commentIndex: number }> = (
    diff ?? []
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
      setSelectedThreadIds([]);
      return;
    }

    // find draft threads in selected range
    const highlightedDraftThreadIds: string[] = [];
    threadsWithPositions.forEach((thread) => {
      if (
        thread.from >= selection.from &&
        thread.to <= selection.to &&
        thread.patches
      ) {
        highlightedDraftThreadIds.push(thread.id);
      }
    });

    setSelectedThreadIds(highlightedDraftThreadIds);
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

    const thread: CommentThread = {
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

  // This takes in a list of virtual threads representing diff patches,
  // and then creates a new thread that combines all of the patches in one.
  // By saving that thread in the actual doc, it will then supercede
  // the previous virtual threads.
  // todo: rename this to something like groupPatches, I'm trying to do minimal structural changes to avoid merge conflicts
  const startCommentForPatchGroup = (selectedThreads: CommentThread[]) => {
    const existingDrafts = selectedThreads.filter(
      (thread) => thread.type === "draft"
    );

    const patches = selectedThreads
      .filter((thread) => thread.type === "ephemeralPatch")
      .flatMap(
        (thread) =>
          thread.patches?.map((patch) => ({
            ...patch,
            /** The stable ID for a patch is its action + a from cursor?
             * TODO: DRY this out with the duplication in utils.ts
             */
            id: `${patch.action}-${thread.fromCursor}`,
          })) ?? []
      );

    // create new thread if all selected patches are virtual
    if (existingDrafts.length == 0) {
      const thread: CommentThread = {
        type: "draft",
        draftTitle: new Haikunator().haikunate({ tokenLength: 0 }),
        id: uuid(),
        comments: [],
        resolved: false,
        // Position the group around the first virtual thread
        fromCursor: selectedThreads[0].fromCursor,
        toCursor: selectedThreads[0].toCursor,
        patches,
      };

      changeDoc((doc) => {
        doc.commentThreads[thread.id] = thread;
      });

      // add to existing thread if there is only one
    } else if (existingDrafts.length === 1) {
      const existingThread = existingDrafts[0];
      changeDoc((doc) => {
        const commentThread = doc.commentThreads[existingThread.id];
        for (const patch of patches) {
          commentThread.patches.push(patch);
        }
      });

      // give up if multiple non virtual change groups are selected
    } else {
      alert("can't merge two groups");
    }
  };

  // reply to a comment thread.
  const addReplyToThread = (thread: CommentThread) => {
    const comment: Comment = {
      id: uuid(),
      content: pendingCommentText,
      contactUrl: account?.contactHandle.url,
      timestamp: Date.now(),
    };

    changeDoc((doc) => {
      const existingThread = doc.commentThreads[thread.id];
      if (existingThread) {
        doc.commentThreads[thread.id].comments.push(comment);
      } else {
        // We're replying to a thread that doesn't exist!
        // This is actually fine because it might be an in-memory thread
        // which represents some ephemeral patches. If that's the case,
        // we gotta initialize a new thread in the automerge doc at this point.
        if (!thread.patches) {
          return;
        }
        const newThread: CommentThread = {
          type: "draft",
          draftTitle: new Haikunator().haikunate({ tokenLength: 0 }),
          id: thread.id,
          comments: [comment],
          resolved: false,
          // Position the thread around the first patch.
          // (in the future we should extend the system so that we can associate
          // a single draft with multiple ranges in the document.)
          fromCursor: thread.fromCursor,
          toCursor: thread.toCursor,
          patches: thread.patches,
        };
        doc.commentThreads[newThread.id] = newThread;
      }
    });

    setPendingCommentText("");
  };

  const undoPatchesForThread = (thread: CommentThread) => {
    for (const patch of thread.patches ?? []) {
      if (!patch.fromCursor) {
        throw new Error("expected patch to have fromCursor");
      }
      const from = A.getCursorPosition(doc, ["content"], patch.fromCursor);
      if (patch.action === "splice") {
        changeDoc((doc) => {
          A.splice(doc, ["content"], from, patch.value.length);
        });
      } else if (patch.action === "del") {
        alert("undoing deletions is not yet implemented");
      }
    }
  };

  const selectedThreadsThatContainEphemeralPatches = selectedThreadIds
    .map((id) => threadsWithPositions.find((thread) => thread.id === id))
    .filter(
      (thread) =>
        thread?.patches && thread.patches.length > 0 && thread.type !== "draft" // if the thread is already a draft we don't want to include it when we make new drafts
    );

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
              const selectedThreads = selectedThreadIds.map((id) =>
                threadsWithPositions.find((thread) => thread.id === id)
              );
              startCommentForPatchGroup(selectedThreads);
              setSelectedThreadIds([]);
            }}
          >
            Make draft
          </Button>
        </div>
      )}
      {threadsWithPositions.map((thread) => (
        <div
          key={thread.id}
          className={`bg-white hover:border-gray-400 hover:bg-gray-50 p-4 mr-2 absolute border border-gray-300 rounded-sm max-w-lg transition-all duration-100 ease-in-out ${
            selectedThreadIds.includes(thread.id)
              ? "z-50 shadow-sm border-gray-500 bg-blue-50 hover:bg-blue-50"
              : "z-0"
          }`}
          style={{
            top: thread.yCoord,
          }}
          onClick={(e) => {
            if (e.shiftKey) {
              setSelectedThreadIds([...selectedThreadIds, thread.id]);
            } else {
              setSelectedThreadIds([thread.id]);
            }
            e.stopPropagation();
          }}
        >
          {thread.type === "draft" && (
            <div className="mb-3 border-b border-gray-300 pb-2 flex items-center text-gray-500">
              <div className="text-xs font-bold mb-1 uppercase mr-1">Draft</div>
              <div className="text-xs">
                {thread.draftTitle ?? "Unknown name"}
              </div>
              <Button
                variant="outline"
                className="ml-2 h-5 max-w-24"
                onClick={() => setFocusedDraftThreadId(thread.id)}
              >
                <Fullscreen className="mr-2 h-4" />
                Focus
              </Button>
            </div>
          )}
          {thread.patches?.length > 0 && (
            <div className="mb-3 border-b border-gray-300 pb-2">
              {thread.patches.map((patch) => (
                // todo: is this a terrible key?
                <div key={`${JSON.stringify(patch)}`} className="select-none">
                  {patch.action === "splice" && (
                    <div className="text-xs">
                      <strong>Insert: </strong>
                      <span className="font-serif">
                        {truncate(patch.value, { length: 50 })}
                      </span>
                    </div>
                  )}
                  {patch.action === "del" && (
                    <div className="text-xs">
                      <strong>Delete: </strong>
                      {patch.length} characters
                    </div>
                  )}
                  {!["splice", "del"].includes(patch.action) && (
                    <div className="font-mono">
                      Unknown action: {patch.action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            {thread.comments.map((comment, index) => {
              const legacyUserName =
                doc.users?.find((user) => user.id === comment.userId)?.name ??
                "Anonymous";

              return (
                <div
                  key={comment.id}
                  className={`mb-3 pb-3  rounded-md border-b border-b-gray-200 last:border-b-0 ${
                    addedComments.find(
                      (c) =>
                        c.threadId === thread.id && c.commentIndex === index
                    ) &&
                    !thread.patches &&
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
              open={activeReplyThreadId === thread.id}
              onOpenChange={(open) =>
                open
                  ? setActiveReplyThreadId(thread.id)
                  : setActiveReplyThreadId(null)
              }
            >
              <PopoverTrigger asChild>
                {thread?.patches &&
                thread.patches.length > 0 &&
                thread.comments.length === 0 ? (
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
                      addReplyToThread(thread);
                      setActiveReplyThreadId(null);
                      event.preventDefault();
                    }
                  }}
                />

                <PopoverClose>
                  <Button
                    variant="outline"
                    onClick={() => addReplyToThread(thread)}
                  >
                    Comment
                    <span className="text-gray-400 ml-2 text-xs">⌘⏎</span>
                  </Button>
                </PopoverClose>
              </PopoverContent>
            </Popover>

            {!thread.patches ||
              (thread.patches.length === 0 && (
                <Button
                  variant="outline"
                  className="select-none"
                  onClick={() =>
                    changeDoc(
                      (d) => (d.commentThreads[thread.id].resolved = true)
                    )
                  }
                >
                  <Check className="mr-2" /> Resolve
                </Button>
              ))}

            {thread.patches && thread.patches.length > 0 && (
              <Button
                variant="outline"
                className="select-none"
                onClick={() => undoPatchesForThread(thread)}
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
