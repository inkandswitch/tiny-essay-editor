import { TextSelection } from "@/tee/components/MarkdownEditor";
import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { MarkdownDoc } from "@/tee/schema";
import * as A from "@automerge/automerge/next";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Completion } from "@codemirror/autocomplete";

import {
  createMentionCompletion,
  createSlashCommandCompletion,
  slashCommands,
} from "./slashCommands";
import { EditorView } from "@codemirror/view";
import { Branchable, DiscussionComment } from "@/patchwork/schema";
import { useCurrentAccount } from "@/DocExplorer/account";
import { Button } from "@/components/ui/button";
import { GitBranchIcon, MilestoneIcon, SendHorizontalIcon } from "lucide-react";
import { DocHandle } from "@automerge/automerge-repo";
import { uuid } from "@automerge/automerge";
import { createBranch, mergeBranch } from "@/patchwork/branches";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import { ChangelogSelection } from "./ReviewSidebar";
import { ChangelogItem } from "@/patchwork/groupChanges";
import { toast } from "sonner";

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

type DiscussionInputProps = {
  doc: MarkdownDoc;
  changeDoc: (fn: (doc: MarkdownDoc) => void) => void;
  handle: DocHandle<MarkdownDoc>;
  textSelection: TextSelection;
  onClearTextSelection: () => void;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
  changelogItems: ChangelogItem[];
  changelogSelection: ChangelogSelection;
};

export const DiscussionInput: React.FC<DiscussionInputProps> = ({
  doc,
  changeDoc,
  handle,
  textSelection,
  onClearTextSelection,
  selectedBranch,
  setSelectedBranch,
  changelogItems,
  changelogSelection,
}) => {
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
    : JSON.parse(
        JSON.stringify(changelogItems[changelogItems.length - 1]?.heads)
      );

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
      };
    });

    onClearTextSelection();
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
        setSelectedBranch({ type: "branch", url: newBranch.url });
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
        setSelectedBranch({ type: "main" });
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
    selectedBranch.type === "branch"
      ? createSlashCommandCompletion("merge", "Merge this branch")
      : undefined,
  ]
    .map((c) => c)
    .filter((c) => c) as Completion[];

  return (
    <div className="border-t border-gray-200 pt-2 px-2 bg-gray-50 z-10">
      {textSelection && textSelection.from !== textSelection.to && doc && (
        <HighlightSnippetView
          from={textSelection.from}
          to={textSelection.to}
          text={doc.content}
        />
      )}
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
                fontSize: "14px",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontWeight: "normal",
              },
            })}
          />

          <div className="flex justify-end mt-2 text-sm">
            <div className="flex items-center">
              {parsedCommentBoxContent.type === "comment" && (
                <Button variant="ghost" onClick={handleSubmitDiscussion}>
                  <SendHorizontalIcon size={14} className="mr-1" />
                  Comment
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
            </div>
          </div>
        </div>
      </div>{" "}
    </div>
  );
};

interface HighlightSnippetViewProps {
  from: number;
  to: number;
  text: string;
}

const SNIPPET_CUTOFF = 75;

const STOP_CHARACTER = [".", "!", "?", "\n"];

export const HighlightSnippetView = ({
  from,
  to,
  text,
}: HighlightSnippetViewProps) => {
  if (from >= text.length || to >= text.length) {
    return null;
  }

  let start = from;
  let startWithEllipsis = true;
  while (start > 0) {
    if (STOP_CHARACTER.includes(text.charAt(start - 1))) {
      startWithEllipsis = false;
      break;
    }

    // make sure we don't cut in the middle of a word
    if (from - start - 1 === SNIPPET_CUTOFF) {
      while (text.charAt(start) !== " ") {
        start++;
      }
      break;
    }

    start--;
  }

  let end = from;
  let endWithEllipsis = true;
  while (end < text.length) {
    if (STOP_CHARACTER.includes(text.charAt(end))) {
      endWithEllipsis = false;
      break;
    }

    // make sure we don't cut in the middle of a word
    if (end - to + 1 === SNIPPET_CUTOFF) {
      while (text.charAt(end) !== " ") {
        end--;
      }
      break;
    }

    end++;
  }

  const before = startWithEllipsis
    ? `...${text.slice(start, from)}`
    : text.slice(start, from).trimStart();
  const highlight = text.slice(from, to);
  const after = endWithEllipsis
    ? `${text.slice(to, end)}...`
    : text.slice(to, end).trimEnd();

  return (
    <div
      className="border-l-2 border-gray-200 p-2 m-2 whitespace-pre-wrap cm-line font-normal"
      style={{ fontFamily: "Merriweather, serif" }}
    >
      {before}
      <span style={{ background: "rgb(255 249 194)" }}>{highlight}</span>
      {after}
    </div>
  );
};
