import { MarkdownDoc } from "@/tee/schema";
import { AutomergeUrl } from "@automerge/automerge-repo";
import * as A from "@automerge/automerge/next";
import CodeMirror from "@uiw/react-codemirror";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import {
  ChangeGroup,
  getChangelogItems,
  getGroupedChanges,
  getMarkersForDoc,
} from "../../groupChanges";

import {
  MessageSquare,
  MilestoneIcon,
  SendHorizontalIcon,
  MergeIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
} from "lucide-react";
import { Heads } from "@automerge/automerge/next";
import { InlineContactAvatar } from "@/DocExplorer/components/InlineContactAvatar";
import { DiffWithProvenance, DiscussionComment } from "../../schema";
import { useCurrentAccount } from "@/DocExplorer/account";
import { Button } from "@/components/ui/button";
import { uuid } from "@automerge/automerge";
import { useSlots } from "@/patchwork/utils";
import { TextSelection } from "@/tee/components/MarkdownEditor";

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { completions, slashCommands } from "./slashCommands";
import { EditorView } from "@codemirror/view";
import { createBranch } from "@/patchwork/branches";
import { SelectedBranch } from "@/DocExplorer/components/DocExplorer";
import { populateChangeGroupSummaries } from "@/patchwork/changeGroupSummaries";
import { debounce, isEqual } from "lodash";

type MilestoneSelection = {
  type: "milestone";
  heads: Heads;
};

// the data structure that represents the range of change groups we've selected for showing diffs.
type ChangeGroupSelection = {
  type: "changeGroups";
  /** The older (causally) change group in the selection */
  from: ChangeGroup["id"];

  /** The newer (causally) change group in the selection */
  to: ChangeGroup["id"];
};

type Selection = MilestoneSelection | ChangeGroupSelection;

const useScrollToBottom = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [scrollerRef.current]);
  return scrollerRef;
};

export const ReviewSidebar: React.FC<{
  docUrl: AutomergeUrl;
  setDocHeads: (heads: Heads) => void;
  setDiff: (diff: DiffWithProvenance) => void;
  selectedBranch: SelectedBranch;
  setSelectedBranch: (branch: SelectedBranch) => void;
  textSelection: TextSelection;
  onClearTextSelection: () => void;
}> = ({
  docUrl,
  setDocHeads,
  setDiff,
  selectedBranch,
  setSelectedBranch,
  textSelection,
  onClearTextSelection,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const repo = useRepo();
  const account = useCurrentAccount();
  const scrollerRef = useScrollToBottom();

  // TODO: technically this should also update when the "source doc" for this branch updates
  const markers = useMemo(
    () => getMarkersForDoc(handle, repo),
    // Important to have doc as a dependency here even though the linter says not needed
    [doc, handle, repo]
  );

  // The grouping function returns change groups starting from the latest change.
  const changelogItems = useMemo(() => {
    if (!doc) return [];

    return getChangelogItems(doc, {
      algorithm: "ByAuthorOrTime",
      numericParameter: 60,
      markers,
    });
  }, [doc, markers]);

  useAutoPopulateChangeGroupSummaries({ handle, changelogItems });

  return (
    <div className="history h-full w-full flex flex-col gap-2 text-xs text-gray-600">
      <div className="overflow-y-scroll flex-1 flex flex-col" ref={scrollerRef}>
        <div className="mt-auto">
          {changelogItems.map((item) => (
            <div key={item.id}>
              {(() => {
                switch (item.type) {
                  case "changeGroup":
                    return <div>Change Group</div>;
                  case "tag":
                    return <div>Milestone</div>;
                  case "branchCreatedFromThisDoc":
                    return <div>Branch Created</div>;
                  case "discussionThread":
                    return <div>Discussion thread</div>;
                  case "originOfThisBranch":
                    return <div>Origin of this branch</div>;
                  case "otherBranchMergedIntoThisDoc":
                    return <div>Branch merged</div>;
                  default: {
                    // Ensure we've handled all types
                    const exhaustiveCheck: never = item;
                    return exhaustiveCheck;
                  }
                }
              })()}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-50 z-10">
        <CommentBox />
      </div>
    </div>
  );
};

const CommentBox = () => {
  return <div className="h-16 bg-red-100 p-5">Comment box</div>;
};

const useAutoPopulateChangeGroupSummaries = ({ handle, changelogItems }) => {
  const debouncedPopulate = useCallback(
    debounce(({ groups, handle, force }) => {
      populateChangeGroupSummaries({ groups, handle, force });
    }, 15000),
    []
  );

  useEffect(() => {
    debouncedPopulate({
      groups: changelogItems.flatMap((item) =>
        item.type === "changeGroup" ? item.changeGroup : []
      ),
      handle,
    });

    // Cleanup function to cancel the debounce if the component unmounts
    return () => {
      debouncedPopulate.cancel();
    };
  }, [changelogItems, handle, debouncedPopulate]);
};
