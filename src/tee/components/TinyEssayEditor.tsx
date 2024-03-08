import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { useEffect, useMemo, useState } from "react";
import { LoadingScreen } from "../../DocExplorer/components/LoadingScreen";
import { DiscussionAnotationForUI, MarkdownDoc } from "../schema";

import { PatchWithAttr } from "@automerge/automerge-wasm";
import { EditorView } from "@codemirror/view";
import { ReviewStateFilter, useAnnotationsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import { useCurrentAccount } from "@/DocExplorer/account";
import { TextPatch } from "@/patchwork/utils";
import { Patch, getCursorPosition, view } from "@automerge/automerge/next";
import { uniq } from "lodash";
import "../../tee/index.css";
import { Discussion } from "@/patchwork/schema";
import { DocEditorProps } from "@/DocExplorer/doctypes";
import { isEqual } from "lodash";
import { DiscussionTargetPosition } from "../codemirrorPlugins/discussionTargetPositionListener";

export const TinyEssayEditor = ({
  docUrl,
  docHeads,
  diff,
  actorIdToAuthor,
  discussions = [],
  selectedDiscussionId,
  hoveredDiscussionId,
  setSelectedDiscussionId,
  onUpdateDiscussionTargetPositions,
}: DocEditorProps) => {
  const account = useCurrentAccount();
  const [doc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>(
    []
  );
  const [editorView, setEditorView] = useState<EditorView>();
  const [isCommentBoxOpen] = useState(false);
  const [editorContainer, setEditorContainer] = useState<HTMLDivElement>(null);
  const readOnly = docHeads && !isEqual(docHeads, A.getHeads(doc));
  const [activeDiscussionTargetPositions, setActiveDiscussionTargetPositions] =
    useState<DiscussionTargetPosition[]>([]);
  const [scrollOffset] = useState(0);

  const [visibleAuthorsForEdits, setVisibleAuthorsForEdits] = useState<
    AutomergeUrl[]
  >([]);

  /* const setSelection = useStaticCallback((newSelection: TextSelection) => {
    if (
      selection &&
      newSelection.from === selection.from &&
      newSelection.to === selection.to
    ) {
      return;
    }

    _setSelection(newSelection);
  }); */

  const [reviewStateFilter, setReviewStateFilter] = useState<ReviewStateFilter>(
    {
      self: "" as AutomergeUrl, // a bit hacky, account might be undefined initially so we just use a dummy value
      showReviewedByOthers: true,
      showReviewedBySelf: false,
    }
  );

  useEffect(() => {
    if (!account) {
      return;
    }

    setReviewStateFilter((filter) => ({
      ...filter,
      self: account.contactHandle.url,
    }));
  }, [account, account?.contactHandle.url]);

  // If the authors on the doc change, show changes by all authors
  useEffect(() => {
    setVisibleAuthorsForEdits(uniq(Object.values(actorIdToAuthor ?? {})));
  }, [actorIdToAuthor]);

  const docAtHeads = useMemo(
    () => (docHeads ? view(doc, docHeads) : doc),
    [doc, docHeads]
  );

  const annotations = useAnnotationsWithPositions({
    doc: docAtHeads,
    view: editorView,
    selectedAnnotationIds: selectedAnnotationIds,
    editorContainer,
    diff,
    visibleAuthorsForEdits,
    reviewStateFilter,
  });

  //  const annotations = annotationsWithPositions;

  // only show a diff in the text editor if we have edits or edit groups on in the sidebar
  const patchesForEditor = useMemo(() => {
    return (
      diff &&
      diff.patches.filter((patch) => {
        if (
          ["splice", "del", "replace"].includes(patch.action) &&
          patch.path[0] === "content"
        ) {
          const draft = Object.values(doc?.drafts ?? {}).find((draft) => {
            return draft.editRangesWithComments.some(({ editRange }) => {
              const from = getCursorPosition(
                docAtHeads,
                ["content"],
                editRange.fromCursor
              );
              const to = getCursorPosition(
                docAtHeads,
                ["content"],
                editRange.toCursor
              );

              const patchFrom = patch.path[1] as number;
              const patchTo = patchFrom + getPatchLength(patch);

              return (
                // this is bad and wrong, replace groups are not create correctly
                (patch.action === "replace" && from === patchFrom) ||
                (from <= patchFrom && to >= patchTo)
              );
            });
          });

          if (draft?.reviews) {
            if (
              !reviewStateFilter.showReviewedBySelf &&
              draft.reviews &&
              draft.reviews[reviewStateFilter.self]
            ) {
              return false;
            }

            const reviewers = Object.keys(draft.reviews);
            if (
              !reviewStateFilter.showReviewedByOthers &&
              (!reviewStateFilter.showReviewedBySelf ||
                !draft.reviews[reviewStateFilter.self]) &&
              (reviewers.length > 1 ||
                (reviewers.length === 1 &&
                  reviewers[0] !== reviewStateFilter.self))
            ) {
              return false;
            }
          }
        }

        // @ts-expect-error - we should know we have patch.attr here?
        return visibleAuthorsForEdits?.includes(patch.attr) || !patch.attr;
      })
    );
  }, [
    diff,
    visibleAuthorsForEdits,
    doc?.drafts,
    docAtHeads,
    reviewStateFilter.showReviewedBySelf,
    reviewStateFilter.self,
    reviewStateFilter.showReviewedByOthers,
  ]);

  const discussionAnnotations = useMemo<DiscussionAnotationForUI[]>(() => {
    if (!doc?.discussions) {
      return [];
    }

    return Object.values(doc.discussions).flatMap((discussion) => {
      if (
        (discussion.target && discussion.target.type !== "editRange") ||
        discussion.resolved === true
      ) {
        return [];
      }

      try {
        return [
          {
            type: "discussion",
            discussion,
            from: A.getCursorPosition(
              doc,
              ["content"],
              discussion.target.value.fromCursor
            ),
            to: A.getCursorPosition(
              doc,
              ["content"],
              discussion.target.value.toCursor
            ),
            active:
              discussion.id === hoveredDiscussionId ||
              discussion.id === selectedDiscussionId,
            id: discussion.id,
          },
        ];
      } catch (err) {
        return [];
      }
    });
  }, [doc, hoveredDiscussionId, selectedDiscussionId]);

  // focus discussion
  useEffect(() => {
    let focusedDiscussion: Discussion;

    if (selection && selection.from === selection.to) {
      focusedDiscussion = (discussions ?? []).find((discussion) => {
        if (!discussion.target || discussion.target.type !== "editRange") {
          return false;
        }

        const from = A.getCursorPosition(
          doc,
          ["content"],
          discussion.target.value.fromCursor
        );
        const to = A.getCursorPosition(
          doc,
          ["content"],
          discussion.target.value.toCursor
        );

        return from <= selection.from && selection.from <= to;
      });

      if (focusedDiscussion) {
        setSelectedDiscussionId(focusedDiscussion.id);
      }
    }
  }, [discussions, doc, selection, setSelectedDiscussionId]);

  // update scroll position
  // scroll selectedDiscussion into view
  useEffect(() => {
    if (!editorContainer) {
      return;
    }

    if (selectedDiscussionId) {
      const target = activeDiscussionTargetPositions.find(
        ({ discussion }) => discussion.id === selectedDiscussionId
      );

      if (!target) {
        return;
      }

      const targetPos = target.y + scrollOffset;

      // unsure why we need to subtract something here otherwise it doesn't scroll all the way to the bottom
      if (target.y < 0 || target.y >= editorContainer.clientHeight - 150) {
        editorContainer.scrollTo({
          top: targetPos,
          behavior: "smooth",
        });
      }

      return;
    }
  }, [
    activeDiscussionTargetPositions,
    editorContainer,
    scrollOffset,
    selectedDiscussionId,
  ]);

  // todo: remove from this component and move up to DocExplorer?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  return (
    <div
      className="h-full overflow-auto min-h-0 w-full"
      ref={setEditorContainer}
    >
      <div className="@container flex bg-gray-100 justify-center">
        {/* This has some subtle behavior for responsiveness.
            - We use container queries to adjust the width of the editor based on the size of our container.
            - We get the right line width by hardcoding a max-width and x-padding
            - We take over the full screen on narrow displays (showing comments on mobile is TODO)
         */}
        <div className="flex @xl:mt-4 @xl:mr-2 @xl:mb-8 @xl:ml-[-100px] @4xl:ml-[-200px] w-full @xl:w-4/5  max-w-[722px]">
          <div
            className={`w-full bg-white box-border rounded-md px-8 py-4 transition-all duration-500 ${
              readOnly
                ? " border-2 border-dashed border-slate-400"
                : "border border-gray-200 "
            }`}
          >
            <MarkdownEditor
              diffStyle="normal"
              handle={handle}
              path={["content"]}
              setSelection={setSelection}
              setView={setEditorView}
              threadsWithPositions={annotations}
              setActiveThreadIds={setSelectedAnnotationIds}
              readOnly={readOnly ?? false}
              docHeads={docHeads}
              diff={patchesForEditor}
              discussionAnnotations={discussionAnnotations}
              onUpdateDiscussionTargetPositions={(targetPositions) => {
                setActiveDiscussionTargetPositions(targetPositions);
                onUpdateDiscussionTargetPositions(targetPositions);
              }}
              isCommentBoxOpen={isCommentBoxOpen}
            />
          </div>
          <div className="ml-2 w-0">
            {/*
              <CommentsSidebar
                handle={handle}
                doc={docAtHeads}
                changeDoc={changeDoc}
                mainDocHandle={mainDocHandle}
                branchDocHandle={branchDocHandle}
                selection={selection}
                reviewStateFilter={reviewStateFilter}
                setReviewStateFilter={setReviewStateFilter}
                selectedAnnotationIds={selectedAnnotationIds}
                setSelectedAnnotationIds={setSelectedAnnotationIds}
                annotationsWithPositions={annotations}
                diff={diff}
                visibleAuthorsForEdits={visibleAuthorsForEdits}
                setVisibleAuthorsForEdits={setVisibleAuthorsForEdits}
                authors={authors}
                isCommentBoxOpen={isCommentBoxOpen}
                setIsCommentBoxOpen={setIsCommentBoxOpen}
              />
            */}
          </div>
        </div>
      </div>
    </div>
  );
};

const getPatchLength = (
  patch: Patch | PatchWithAttr<AutomergeUrl> | TextPatch
) => {
  switch (patch.action) {
    case "del":
      return patch.length;
    case "splice":
      return patch.value.length;
    case "replace":
      return patch.raw.splice.value.length;
  }
};
