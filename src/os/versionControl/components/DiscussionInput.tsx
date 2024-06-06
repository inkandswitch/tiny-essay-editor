import { Button } from "@/components/ui/button";
import { useCurrentAccount } from "@/os/explorer/account";
import { MarkdownInput } from "@/os/lib/markdown";
import { TimelineItems } from "@/os/versionControl/groupChanges";
import {
  DiscussionComment,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { uuid } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import { SendHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { ChangelogSelection } from "./TimelineSidebar";

type DiscussionInputProps<D> = {
  doc: D;
  handle: DocHandle<D>;
  changelogItems: TimelineItems<D>[];
  changelogSelection: ChangelogSelection;
};
export const DiscussionInput = function <
  D extends HasVersionControlMetadata<unknown, unknown>
>({
  doc,
  handle,
  changelogItems,
  changelogSelection,
}: DiscussionInputProps<D>) {
  const account = useCurrentAccount();
  const [commentBoxContent, setCommentBoxContent] = useState("");

  const currentlyActiveHeads = changelogSelection
    ? JSON.parse(
        JSON.stringify(
          changelogItems.find((i) => i.id === changelogSelection.to.itemId)
            ?.heads
        )
      )
    : A.getHeads(doc);

  const createDiscussion = () => {
    if (commentBoxContent === "") {
      return;
    }

    /** migration for legacy docs */

    const comment: DiscussionComment = {
      id: uuid(),
      content: commentBoxContent,
      timestamp: Date.now(),
      contactUrl: account?.contactHandle?.url,
    };
    const discussionId = uuid();

    handle.change((doc) => {
      if (!doc.discussions) {
        doc.discussions = {};
      }

      doc.discussions[discussionId] = {
        id: discussionId,
        heads: currentlyActiveHeads,
        resolved: false,
        comments: [comment],
        anchors: [],
      };
    });

    setCommentBoxContent("");
  };

  const onKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
      evt.stopPropagation();
      evt.preventDefault();
      createDiscussion();
    }
  };

  return (
    <div className="border-t border-gray-200 pt-2 px-2 bg-gray-50 z-10">
      <div>
        <div className="rounded bg-white shadow">
          <div className="p-1" onKeyDownCapture={onKeyDown}>
            <MarkdownInput
              value={commentBoxContent}
              onChange={setCommentBoxContent}
              docWithAssetsHandle={handle}
            />
          </div>
          <div className="flex justify-end mt-2 text-sm">
            <div className="flex items-center">
              <Button variant="ghost" onClick={createDiscussion}>
                <SendHorizontalIcon size={14} className="mr-1" />
                Write a note
                <span className="text-gray-400 text-xs ml-2">(⌘+enter)</span>
              </Button>
            </div>
          </div>
        </div>
      </div>{" "}
    </div>
  );
};
