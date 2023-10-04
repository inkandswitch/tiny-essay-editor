import { Button } from "@/components/ui/button";
import {
  Comment,
  CommentThread,
  CommentThreadWithResolvedPositions,
  LocalSession,
  MarkdownDoc,
} from "../schema";

import { MessageSquarePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { next as A, ChangeFn, uuid } from "@automerge/automerge";
import { mapValues } from "lodash";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TextSelection } from "./MarkdownEditor";
import { EditorView } from "codemirror";

export const CommentsSidebar = ({
  doc,
  changeDoc,
  selection,
  view,
  session,
}: {
  doc: MarkdownDoc;
  changeDoc: (changeFn: ChangeFn<MarkdownDoc>) => void;
  selection: TextSelection;
  view: EditorView;
  session: LocalSession;
}) => {
  const showCommentButton = selection && selection.from !== selection.to;

  const threadsWithPositions: {
    [key: string]: CommentThreadWithResolvedPositions;
  } = mapValues(doc?.commentThreads ?? {}, (thread) => {
    const from = A.getCursorPosition(doc, ["content"], thread.fromCursor);
    const to = A.getCursorPosition(doc, ["content"], thread.toCursor);
    const topOfEditor = view?.scrollDOM.getBoundingClientRect().top ?? 0;
    const viewportCoordsOfThread = view?.coordsAtPos(from).top ?? 0;
    const yCoord = -1 * topOfEditor + viewportCoordsOfThread + 80; // why 100??

    console.log({ from, to, topOfEditor, viewportCoordsOfThread, yCoord });

    return {
      ...thread,
      from,
      to,
      yCoord,
    };
  });

  const startCommentThreadAtSelection = (commentText: string) => {
    if (!selection) return;

    const fromCursor = A.getCursor(doc, ["content"], selection.from);
    const toCursor = A.getCursor(doc, ["content"], selection.to);

    const comment: Comment = {
      id: uuid(),
      content: commentText,
      userId: session?.userId ?? null,
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
  };

  return (
    <div>
      <div className="flex-grow bg-gray-50 p-4">
        {Object.values(threadsWithPositions).map((thread) => (
          <div
            key={thread.id}
            className="bg-white p-4 absolute"
            style={{ top: thread.yCoord }}
          >
            {thread.comments.map((comment) => (
              <div>
                <div className="mb-2">{comment.content}</div>
                <div className="text-sm text-gray-600">
                  {doc.users.find((user) => user.id === comment.userId).name ??
                    "unknown"}
                </div>
              </div>
            ))}
          </div>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className={`transition fixed duration-200 ease-in-out ${
                showCommentButton ? "opacity-100" : "opacity-0"
              }`}
              variant="outline"
              style={{
                top: (selection?.yCoord ?? 0) - 11,
              }}
            >
              <MessageSquarePlus size={24} className="mr-2" />
              Add a comment
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Textarea className="mb-4" />
            <Button
              variant="outline"
              onClick={() => startCommentThreadAtSelection("hello")}
            >
              Comment
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
