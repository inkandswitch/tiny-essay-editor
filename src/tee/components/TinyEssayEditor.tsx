import { MarkdownEditor, TextSelection } from "./MarkdownEditor";
import { useRef, useState } from "react";

import { EditorView } from "@codemirror/view";
import { CommentsSidebar } from "./CommentsSidebar";
import { useThreadsWithPositions } from "../utils";

// TODO: audit the CSS being imported here;
// it should be all 1) specific to TEE, 2) not dependent on viewport / media queries
import "../../tee/index.css";
import { EssayAsFunctionsOld } from "../schemas/Essay";
import { LoadDocumentChildProps } from "@/automerge-repo-schema-utils/utils";

export const TinyEssayEditor = ({
  doc,
  changeDoc,
  handle,
}: LoadDocumentChildProps<Essay>) => {
  const [selection, setSelection] = useState<TextSelection>();
  const [activeThreadId, setActiveThreadId] = useState<string | null>();
  const [view, setView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  const threadsWithPositions = useThreadsWithPositions({
    doc,
    view,
    activeThreadId,
    editorRef,
  });

  return (
    <div className="h-full overflow-auto" ref={editorRef}>
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
            setView={setView}
            threadsWithPositions={threadsWithPositions}
            setActiveThreadId={setActiveThreadId}
          />
        </div>
        <div className="w-0">
          <CommentsSidebar
            doc={doc}
            changeDoc={changeDoc}
            selection={selection}
            activeThreadId={activeThreadId}
            setActiveThreadId={setActiveThreadId}
            threadsWithPositions={threadsWithPositions}
          />
        </div>
      </div>
    </div>
  );
};
