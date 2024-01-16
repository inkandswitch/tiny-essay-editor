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

const MIN_SNIPPET_SIZE = 50;

interface Snippet {
  from: number;
  to: number;
  text: string;
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
    if (size < MIN_SNIPPET_SIZE) {
      return;
    }

    // on delete get's called before the transaction is applied to the document
    const headsBeforeDelete = A.getHeads(handle.docSync());

    // need to check prevDiffHeads inside of setter, because onDelete is cached on initialization in codemirror
    setDiffHeads((prevDiffHeads) =>
      prevDiffHeads ? prevDiffHeads : headsBeforeDelete
    );
  };

  const snippets: Snippet[] = useMemo(() => {
    if (!diffHeads || !doc) {
      return [];
    }

    const patches = A.diff(doc, A.getHeads(doc), diffHeads);
    const insertedRanges = new Map<number, number>();

    // collection insertions
    for (const patch of patches) {
      const [key, index] = patch.path;
      if (key !== "content") {
        continue;
      }
      if (patch.action === "del") {
        insertedRanges.set(index, patch.length);
      }
    }

    const snippets: Snippet[] = [];

    // turn splices into snippets
    for (const patch of patches) {
      const [key, index] = patch.path;

      if (
        key !== "content" ||
        patch.action !== "splice" ||
        patch.value.length < MIN_SNIPPET_SIZE
      ) {
        continue;
      }

      const replacementOfSnippetLength = insertedRanges.get(index) ?? 0;

      const from = index;
      const to = index + replacementOfSnippetLength;
      const fromY = editorView.coordsAtPos(from).top;
      const toY = editorView.coordsAtPos(to).bottom;

      snippets.push({
        from,
        to,
        text: patch.value,
        y: fromY,
        height: toY - fromY,
      });
    }

    return snippets;
  }, [diffHeads, doc]);

  console.log("snippets", snippets);

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

  const debugHighlights = snippets.flatMap((snippet) => {
    if (snippet.from === snippet.to) {
      return [];
    }

    return [
      {
        from: snippet.from,
        to: snippet.to,
        class: "text-blue-500",
      },
    ];
  });

  return (
    <div className="flex overflow-y-hidden h-full ">
      <div className="flex-grow overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="@container flex bg-gray-50">
            <div
              className="bg-white border-r border-gray-200 box-border w-full max-w-[722px] px-8 py-4"
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
                debugHighlights={debugHighlights}
              />
            </div>
            <div className="relative">
              {snippets.map(({ text, y, height }, index) => {
                return (
                  <div
                    key={index}
                    className="absolute bg-white border border-gray-200 box-border rounded-md px-8 py-4 cm-line overflow-hidden left-2"
                    style={{
                      top: `${y - 50}px`,
                      width: `${editorWidth}px`,
                      height: `${height}px`,
                    }}
                  >
                    {text}
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
