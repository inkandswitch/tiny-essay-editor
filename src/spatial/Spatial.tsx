import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { MarkdownDoc } from "@/tee/schema";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView } from "@codemirror/view";
import React, { useEffect, useMemo, useRef, useState } from "react";

interface Deletion {
  from: number;
  to: number;
  previousText: string;
}

const MIN_DELETE_SIZE = 1;

interface DeletionWithPosition extends Deletion {
  y: number;
  height: number;
}

export const SpatialHistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>();
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  const [diffHeads, setDiffHeads] = useLocalStorageState<A.Heads>(
    `${docUrl}.diffHeads`
  );

  const [editorWidth, setEditorWidth] = useState<number>();

  const onDelete = (size) => {
    if (size < MIN_DELETE_SIZE) {
      return;
    }

    if (!diffHeads) {
      // on delete get's called before the transaction is applied to the document
      const headsBeforeDelete = A.getHeads(handle.docSync());
      setDiffHeads(headsBeforeDelete);
    }
  };

  const patches: A.Patch[] = useMemo(() => {
    if (!diffHeads || !doc) {
      return [];
    }

    return A.diff(doc, A.getHeads(doc), diffHeads);
  }, [diffHeads, doc]);

  console.log("patches", patches);

  // update editor width
  useEffect(() => {
    if (!editorRef) {
      return;
    }

    setEditorWidth(editorRef.current.getBoundingClientRect().width);

    const handleResize = () => {
      setEditorWidth(editorRef.current.getBoundingClientRect().width);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [editorRef.current]);

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="@container flex bg-gray-50 justify-center">
            <div
              className="bg-white border border-gray-200 box-border rounded-md w-full @xl:w-4/5 @xl:mt-4 @xl:mr-2 @xl:mb-8 max-w-[722px]  @xl:ml-[-100px] @4xl:ml-[-200px] px-8 py-4"
              ref={editorRef}
            >
              <MarkdownEditor
                key={docUrl}
                handle={handle}
                path={["content"]}
                setSelection={() => {}}
                setView={setEditorView}
                threadsWithPositions={[]}
                setActiveThreadId={() => {}}
                readOnly={false}
                diffStyle="normal"
                onDelete={onDelete}
              />
            </div>
            <div className="relative">
              {false &&
                [].map(({ previousText, y, height }, index) => {
                  return (
                    <div
                      key={index}
                      className="absolute bg-white border border-gray-200 box-border rounded-md px-8 py-4"
                      style={{
                        top: `${y}px`,
                        width: `${editorWidth}px`,
                        left: 0,
                      }}
                    >
                      {previousText}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function useLocalStorageState<T>(
  key,
  defaultValue = ""
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Get from local storage then
  // parse stored json or if none return initialValue
  const [state, setState] = useState(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
  });

  // Update local storage when state changes
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
