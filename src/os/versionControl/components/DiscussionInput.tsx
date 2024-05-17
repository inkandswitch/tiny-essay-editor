import * as A from "@automerge/automerge/next";
import CodeMirror from "@uiw/react-codemirror";
import { useState } from "react";

import { Completion } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";

import { Button } from "@/components/ui/button";
import { useCurrentAccount } from "@/os/explorer/account";
import { createBranch, mergeBranch } from "@/os/versionControl/branches";
import { TimelineItems } from "@/os/versionControl/groupChanges";
import {
  Branch,
  Branchable,
  DiscussionComment,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { uuid } from "@automerge/automerge";
import { DocHandle } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { EditorView } from "@codemirror/view";
import {
  GitBranchIcon,
  MergeIcon,
  MilestoneIcon,
  SendHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ChangelogSelection } from "./TimelineSidebar";
import {
  createMentionCompletion,
  createSlashCommandCompletion,
  slashCommands,
} from "./slashCommands";

type CommentBoxAction =
  | { type: "comment"; value: string }
  | { type: "branch"; name?: string }
  | { type: "milestone"; name?: string }
  | { type: "mergeBranch" };

const parseCommentBoxContent = (content: string): CommentBoxAction => {
  if (content.startsWith("/branch")) {
    const name = content.replace("/branch", "").trim();
    return { type: "branch", name: name || undefined };
  } else if (content.startsWith("/milestone")) {
    const name = content.replace("/milestone", "").trim();
    return { type: "milestone", name: name || undefined };
  } else if (content.startsWith("/merge")) {
    return { type: "mergeBranch" };
  } else {
    return { type: "comment", value: content };
  }
};

type DiscussionInputProps<T> = {
  doc: T;
  changeDoc: (fn: (doc: T) => void) => void;
  handle: DocHandle<T>;
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
  changelogItems: TimelineItems<T>[];
  changelogSelection: ChangelogSelection;
};
export const DiscussionInput = function <
  T extends HasVersionControlMetadata<unknown, unknown>
>({
  doc,
  changeDoc,
  handle,
  selectedBranch,
  setSelectedBranch,
  changelogItems,
  changelogSelection,
}: DiscussionInputProps<T>) {
  const repo = useRepo();
  const account = useCurrentAccount();
  const [commentBoxContent, setCommentBoxContent] = useState("");
  const parsedCommentBoxContent: CommentBoxAction =
    parseCommentBoxContent(commentBoxContent);

  const createMilestone = ({
    name,
    heads,
  }: {
    name: string;
    heads: A.Heads;
  }) => {
    changeDoc((doc) => {
      if (!doc.tags) {
        doc.tags = [];
      }
      doc.tags.push({
        name,
        heads,
        createdAt: Date.now(),
        createdBy: account?.contactHandle?.url,
      });
    });
  };

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

    changeDoc((doc) => {
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
  const handleSubmitDiscussion = () => {
    switch (parsedCommentBoxContent.type) {
      case "comment": {
        createDiscussion();
        break;
      }
      case "branch": {
        const newBranch = createBranch({
          repo,
          handle,
          name: parsedCommentBoxContent.name,
          heads: currentlyActiveHeads,
          createdBy: account?.contactHandle?.url,
        });
        setSelectedBranch(newBranch);
        setCommentBoxContent("");
        break;
      }
      case "milestone": {
        createMilestone({
          name: parsedCommentBoxContent.name || new Date().toLocaleDateString(),
          heads: currentlyActiveHeads,
        });
        setCommentBoxContent("");
        break;
      }
      case "mergeBranch": {
        const docHandle = repo.find<Branchable>(doc.branchMetadata.source.url);
        if (!docHandle) return;
        mergeBranch({
          branchHandle: handle,
          docHandle,
          mergedBy: account?.contactHandle?.url,
        });
        setCommentBoxContent("");
        setSelectedBranch(null);
        toast.success("Branch merged to main");
        break;
      }
      default: {
        // This ensures we handle all possible types of parsedCommentBoxContent
        const exhaustiveCheck: never = parsedCommentBoxContent;
        return exhaustiveCheck;
      }
    }
  };
  const completions: Completion[] = [
    createMentionCompletion("adam"),
    createMentionCompletion("geoffrey"),
    createMentionCompletion("max"),
    createMentionCompletion("paul"),
    createSlashCommandCompletion("branch", "Create a new branch"),
    createSlashCommandCompletion(
      "milestone",
      "Mark a milestone at the current point"
    ),
    selectedBranch
      ? createSlashCommandCompletion("merge", "Merge this branch")
      : undefined,
  ]
    .map((c) => c)
    .filter((c) => c) as Completion[];

  return (
    <div className="border-t border-gray-200 pt-2 px-2 bg-gray-50 z-10">
      <div>
        <div className="rounded bg-white shadow">
          <CodeMirror
            basicSetup={{
              foldGutter: false,
              highlightActiveLine: false,
              lineNumbers: false,
            }}
            className="p-1 min-h-12 max-h-24 overflow-y-auto"
            extensions={[
              markdown({ base: markdownLanguage, codeLanguages: languages }),
              slashCommands(completions),
              EditorView.lineWrapping,
            ]}
            onChange={(value) => setCommentBoxContent(value)}
            onKeyDown={(e) => {
              if (e.metaKey && e.key === "Enter") {
                handleSubmitDiscussion();
                e.stopPropagation();
              }
            }}
            value={commentBoxContent}
            theme={EditorView.theme({
              "&.cm-editor": {
                height: "100%",
              },
              "&.cm-focused": {
                outline: "none",
              },
              ".cm-scroller": {
                height: "100%",
              },
              ".cm-content": {
                height: "100%",
                fontSize: "12px",
                fontFamily: "monospace",
                fontWeight: "normal",
              },
            })}
          />

          <div className="flex justify-end mt-2 text-sm">
            <div className="flex items-center">
              {parsedCommentBoxContent.type === "comment" && (
                <Button variant="ghost" onClick={handleSubmitDiscussion}>
                  <SendHorizontalIcon size={14} className="mr-1" />
                  Write a note
                  <span className="text-gray-400 text-xs ml-2">(⌘+enter)</span>
                </Button>
              )}
              {parsedCommentBoxContent.type === "branch" && (
                <Button variant="ghost" onClick={handleSubmitDiscussion}>
                  <GitBranchIcon size={14} className="mr-1" />
                  Create branch
                  <span className="text-gray-400 text-xs ml-2">(⌘+enter)</span>
                </Button>
              )}
              {parsedCommentBoxContent.type === "milestone" && (
                <Button variant="ghost" onClick={handleSubmitDiscussion}>
                  <MilestoneIcon size={14} className="mr-1" />
                  Save milestone
                  <span className="text-gray-400 text-xs ml-2">(⌘+enter)</span>
                </Button>
              )}
              {parsedCommentBoxContent.type === "mergeBranch" && (
                <Button variant="ghost" onClick={handleSubmitDiscussion}>
                  <MergeIcon size={14} className="mr-1" />
                  Merge branch
                  <span className="text-gray-400 text-xs ml-2">(⌘+enter)</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>{" "}
    </div>
  );
};
