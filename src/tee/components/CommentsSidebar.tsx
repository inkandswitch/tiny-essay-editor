import { Button } from "@/components/ui/button";
import {
  Comment,
  TextAnnotationWithPosition,
  MarkdownDoc,
  DraftAnnotation,
} from "../schema";
import { DiffWithProvenance } from "@/patchwork/schema";

import { groupBy, uniq } from "lodash";
import { DocHandle, isValidAutomergeUrl } from "@automerge/automerge-repo";

import {
  Check,
  FolderIcon,
  FolderOpenIcon,
  MessageCircleIcon,
  MessageSquarePlus,
  Reply,
  UndoIcon,
  CheckIcon,
  MergeIcon,
  ArrowRight,
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
import { useEffect, useMemo, useState } from "react";
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
import { copyDocAtHeads } from "@/patchwork/utils";
import { DiscussionComment } from "@/patchwork/schema";

const EXTEND_CHANGES_TO_WORD_BOUNDARIES = false; // @paul it doesn't quite work for deletes so I'm disabling it for now

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  setIsCommentBoxOpen,
  isCommentBoxOpen,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  setIsCommentBoxOpen: (isOpen: boolean) => void;
  isCommentBoxOpen: boolean;
}) => {
  const account = useCurrentAccount();
  const [pendingCommentText, setPendingCommentText] = useState("");

  // suppress showing the button immediately after adding a thread
  const [suppressButton, setSuppressButton] = useState(false);
  const showCommentButton =
    selection && selection.from !== selection.to && !suppressButton;

  // un-suppress the button once the selection changes
  useEffect(() => {
    setSuppressButton(false);
  }, [selection?.from, selection?.to]);

  const startDiscusssionAtSelection = (commentText: string) => {
    if (!selection || !commentText) return;

    const amRange = cmRangeToAMRange(selection);

    const fromCursor = A.getCursor(doc, ["content"], amRange.from);
    const toCursor = A.getCursor(doc, ["content"], amRange.to);

    /** migration for legacy docs */
    const comment: DiscussionComment = {
      id: uuid(),
      content: commentText,
      timestamp: Date.now(),
      contactUrl: account?.contactHandle?.url,
    };
    const discussionId = uuid();

    changeDoc((doc) => {
      if (!doc.discussions) {
        doc.discussions = {};
      }

      doc.discussions[discussionId] = {
        id: discussionId,
        // todo: this is wrong, we need to get the heads of the latest edit group / selected edit group
        // we only have that information in the ReviewSidebar and
        // we can't pull up this state because grouping is slow
        heads: A.getHeads(doc),
        resolved: false,
        comments: [comment],
        target: {
          type: "editRange",
          value: { fromCursor, toCursor },
        },
      };
    });

    setPendingCommentText("");
  };

  return (
    <div className="w-72">
      <Popover open={isCommentBoxOpen} onOpenChange={setIsCommentBoxOpen}>
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
                startDiscusssionAtSelection(pendingCommentText);
                setSuppressButton(true);
                setIsCommentBoxOpen(false);
                event.preventDefault();
              }
            }}
          />

          <PopoverClose>
            <Button
              variant="outline"
              onClick={() => {
                startDiscusssionAtSelection(pendingCommentText);
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

const PUNCTUATION_REGEX = /[!\"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~“”]/;

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

export function CompactCommentView({ comment }: { comment: Comment }) {
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
