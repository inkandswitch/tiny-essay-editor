import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { DiffStyle, MarkdownEditor, TextSelection } from "./MarkdownEditor";

import {
  AnnotationPosition,
  DiffWithProvenance,
  DraftAnnotation,
  MarkdownDoc,
  TextAnnotation,
} from "../schema";
import { LoadingScreen } from "../../DocExplorer/components/LoadingScreen";
import { useRef, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { getRelativeTimeString, useAnnotationsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import "../../tee/index.css";
import { Heads, getHeads, view } from "@automerge/automerge/next";
import { Button } from "@/components/ui/button";
import { ShrinkIcon } from "lucide-react";
import { ContactAvatar } from "@/DocExplorer/components/ContactAvatar";
import { truncate } from "lodash";

export const TinyEssayEditor = ({
  docUrl,
  docHeads,
  diff,
  readOnly,
  diffStyle,
  foldRanges,
  showDiffAsComments,
  diffBase,
}: {
  docUrl: AutomergeUrl;
  docHeads?: Heads;
  diff?: DiffWithProvenance;
  readOnly?: boolean;
  diffStyle?: DiffStyle;
  foldRanges?: { from: number; to: number }[];
  showDiffAsComments?: boolean;
  diffBase?: Heads;
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl); // used to trigger re-rendering when the doc loads
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>(
    []
  );
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);
  const [focusedDraftThreadId, setFocusedDraftThreadId] = useState<string>();
  const [visibleAnnotationTypes, setVisibleAnnotationTypes] = useState<
    TextAnnotation["type"][]
  >(["thread", "draft", "patch"]);

  const annotationsWithPositions = useAnnotationsWithPositions({
    doc,
    view: editorView,
    selectedAnnotationIds: selectedAnnotationIds,
    editorRef,
    diff: showDiffAsComments ? diff : undefined,
    diffBase,
    visibleAnnotationTypes,
  });

  // todo: remove from this component and move up to DocExplorer?
  if (!doc) {
    return <LoadingScreen docUrl={docUrl} handle={handle} />;
  }

  const focusedDraft = annotationsWithPositions.find(
    (thread) => thread.id === focusedDraftThreadId
  ) as (DraftAnnotation & AnnotationPosition & { yCoord: number }) | undefined;

  const annotations = focusedDraft ? [focusedDraft] : annotationsWithPositions;

  // only show a diff in the text editor if we have edits or edit groups on in the sidebar
  const patchesForEditor =
    diff &&
    (visibleAnnotationTypes.includes("draft") ||
      visibleAnnotationTypes.includes("patch"))
      ? diff.patches
      : undefined;

  const docAtHeads = docHeads ? view(doc, docHeads) : doc;
  return (
    <div className="h-full overflow-auto" ref={editorRef}>
      {focusedDraft && (
        <div className="w-full p-4">
          <div className="mb-3 border-b border-gray-300 pb-2 flex items-center text-gray-500">
            <div className="text-xs font-bold mb-1 uppercase mr-1">Draft</div>
            <div className="text-xs">{focusedDraft.title}</div>
            <Button
              variant="outline"
              className="ml-2 h-5 max-w-36"
              onClick={() => setFocusedDraftThreadId(null)}
            >
              <ShrinkIcon className="mr-2 h-4" />
              Unfocus
            </Button>
          </div>
          <div className="mb-3 border-b border-gray-300 pb-2">
            {focusedDraft.editRangesWithComments
              .flatMap((editRange) => editRange.patches)
              .map((patch) => (
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
          <div>
            {/* TODO: DRY This with comments sidebar */}
            {focusedDraft.comments.map((comment) => {
              const legacyUserName =
                doc.users?.find((user) => user.id === comment.userId)?.name ??
                "Anonymous";

              return (
                <div
                  key={comment.id}
                  className={`mb-3 pb-3  rounded-md border-b border-b-gray-200 last:border-b-0`}
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
        </div>
      )}
      <div className="@container flex bg-gray-50 justify-center">
        {/* This has some subtle behavior for responsiveness.
            - We use container queries to adjust the width of the editor based on the size of our container.
            - We get the right line width by hardcoding a max-width and x-padding
            - We take over the full screen on narrow displays (showing comments on mobile is TODO)
         */}
        <div className="bg-white border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4 ">
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
          />
        </div>
        <div className="w-0">
          <CommentsSidebar
            doc={docAtHeads}
            changeDoc={changeDoc}
            selection={selection}
            selectedAnnotationIds={selectedAnnotationIds}
            setSelectedAnnotationIds={setSelectedAnnotationIds}
            annotationsWithPositions={annotations}
            diff={diff}
            focusedDraftThreadId={focusedDraftThreadId}
            setFocusedDraftThreadId={setFocusedDraftThreadId}
            visibleAnnotationTypes={visibleAnnotationTypes}
            setVisibleAnnotationTypes={setVisibleAnnotationTypes}
          />
        </div>
      </div>
    </div>
  );
};
