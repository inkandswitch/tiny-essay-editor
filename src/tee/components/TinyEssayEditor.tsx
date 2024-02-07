import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { DiffStyle, MarkdownEditor, TextSelection } from "./MarkdownEditor";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoadingScreen } from "../../DocExplorer/components/LoadingScreen";
import { DiffWithProvenance, MarkdownDoc } from "../schema";

import { PatchWithAttr } from "@automerge/automerge-wasm";
import { EditorView } from "@codemirror/view";
import { ReviewStateFilter, useAnnotationsWithPositions } from "../utils";
import { CommentsSidebar } from "./CommentsSidebar";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import { useCurrentAccount } from "@/DocExplorer/account";
import { TextPatch } from "@/chronicle/utils";
import {
  ActorId,
  Heads,
  Patch,
  getCursorPosition,
  view,
} from "@automerge/automerge/next";
import { uniq } from "lodash";
import "../../tee/index.css";
import { DebugHighlight } from "../codemirrorPlugins/DebugHighlight";

export const TinyEssayEditor = ({
  docUrl,
  docHeads,
  diff,
  readOnly,
  diffStyle,
  foldRanges,
  showDiffAsComments,
  diffBase,
  actorIdToAuthor,
  onChangeSelection,
  debugHighlights,
}: {
  docUrl: AutomergeUrl;
  docHeads?: Heads;
  diff?: DiffWithProvenance;
  readOnly?: boolean;
  diffStyle?: DiffStyle;
  foldRanges?: { from: number; to: number }[];
  showDiffAsComments?: boolean;
  diffBase?: Heads;
  onChangeSelection?: (selection: TextSelection) => void;
  actorIdToAuthor?: Record<ActorId, AutomergeUrl>;
  debugHighlights?: DebugHighlight[];
}) => {
  const account = useCurrentAccount();
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, _setSelection] = useState<TextSelection>();
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>(
    []
  );
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  const [visibleAuthorsForEdits, setVisibleAuthorsForEdits] = useState<
    AutomergeUrl[]
  >([]);

  const setSelection = (selection: TextSelection) => {
    _setSelection(selection);

    if (onChangeSelection) {
      onChangeSelection(selection);
    }
  };

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
  }, [account?.contactHandle.url]);

  const authors = uniq(Object.values(actorIdToAuthor ?? {}));

  // If the authors on the doc change, show changes by all authors
  useEffect(() => {
    setVisibleAuthorsForEdits(uniq(Object.values(actorIdToAuthor ?? {})));
  }, [actorIdToAuthor]);

  const annotationsWithPositions = useAnnotationsWithPositions({
    doc,
    view: editorView,
    selectedAnnotationIds: selectedAnnotationIds,
    editorRef,
    diff: showDiffAsComments ? diff : undefined,
    diffBase,
    visibleAuthorsForEdits,
    reviewStateFilter,
  });

  const annotations = annotationsWithPositions;

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
                doc,
                ["content"],
                editRange.fromCursor
              );
              const to = getCursorPosition(
                doc,
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
  }, [diff, visibleAuthorsForEdits, reviewStateFilter]);

  // todo: remove from this component and move up to DocExplorer?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  const docAtHeads = docHeads ? view(doc, docHeads) : doc;
  return (
    <div className="h-full overflow-auto" ref={editorRef}>
      <div className="@container flex bg-gray-50 justify-center">
        {/* This has some subtle behavior for responsiveness.
            - We use container queries to adjust the width of the editor based on the size of our container.
            - We get the right line width by hardcoding a max-width and x-padding
            - We take over the full screen on narrow displays (showing comments on mobile is TODO)
         */}
        <div
          className={`${
            readOnly ? " bg-slate-200" : "bg-white"
          } border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4 `}
        >
          <MarkdownEditor
            handle={handle}
            path={["content"]}
            setSelection={setSelection}
            setView={setEditorView}
            threadsWithPositions={annotations}
            setActiveThreadIds={setSelectedAnnotationIds}
            readOnly={readOnly ?? false}
            docHeads={docHeads}
            diff={patchesForEditor}
            diffStyle={diffStyle ?? "normal"}
            foldRanges={foldRanges}
            debugHighlights={debugHighlights}
          />
        </div>
        <div className="w-0">
          <CommentsSidebar
            diffBase={diffBase}
            doc={docAtHeads}
            changeDoc={changeDoc}
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
          />
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
      return patch.splice.value.length;
  }
};
