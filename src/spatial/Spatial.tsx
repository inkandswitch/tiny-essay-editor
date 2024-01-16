import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { MarkdownDoc } from "@/tee/schema";
import { Doc } from "@automerge/automerge";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView } from "@codemirror/view";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Snippet {
  cursor: A.Cursor;
  heads: A.Heads;
}

interface ResolvedSnippet {
  text: string;
  from: number;
  to: number;
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

  const [snippets, setSnippets] = useState<Snippet[]>([]);

  const [editorWidth, setEditorWidth] = useState<number>();

  const onDelete = (position) => {
    const doc = handle.docSync();
    const cursor = A.getCursor(doc, ["content"], position - 1); // cursors don't have a side so we need to anchor to the character before the delete

    // on delete get's called before the transaction is applied to the document
    const headsBeforeDelete = A.getHeads(handle.docSync());

    setSnippets((snippets) =>
      snippets.concat({
        cursor,
        heads: headsBeforeDelete,
      })
    );
  };

  const onRemoveSnippetAtIndex = (indexToDelete: number) => {
    setSnippets((snippets) =>
      snippets.filter((snippet, index) => index !== indexToDelete)
    );
  };

  const onToggleExpandSnippetAtIndex = (indexToToggle: number) => {};

  const resolvedSnippets: ResolvedSnippet[] = useMemo(() => {
    const resolvedSnippets: ResolvedSnippet[] = [];

    for (const snippet of snippets) {
      const patches = A.diff(doc, A.getHeads(doc), snippet.heads);

      const from = safelyGetCursorPosition(doc, snippet.cursor) + 1; // cursor points to previous character so we need to add one
      if (from === null) {
        continue;
      }

      console.log("patches", from, patches);

      // all ops are inverted so this corresponds to the patch of stuff that was inserted where the snippet used to be
      const delPatchAtFrom = patches.find((patch: A.Patch) => {
        const [key, index] = patch.path;
        return key === "content" && patch.action === "del" && index === from;
      });

      const to = delPatchAtFrom ? from + (delPatchAtFrom.length ?? 1) : from;

      // splice
      const splicePatchAtFrom = patches.find((patch) => {
        const [key, index] = patch.path;

        console.log(patch.action, index, from);

        return key === "content" && patch.action === "splice" && index === from;
      });

      if (!splicePatchAtFrom) {
        continue;
      }

      const fromY = editorView.coordsAtPos(from).top;
      const toY = editorView.coordsAtPos(to).bottom;

      resolvedSnippets.push({
        from,
        to,
        text: splicePatchAtFrom.value,
        y: fromY,
        height: toY - fromY,
      });
    }

    return resolvedSnippets;
  }, [snippets, doc]);

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

  const debugHighlights = resolvedSnippets.flatMap((snippet) => {
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
                onModDelete={onDelete}
                debugHighlights={debugHighlights}
              />
            </div>
            <div className="relative">
              {resolvedSnippets.map(({ text, y, height }, index) => {
                return (
                  <div
                    className="left-4 absolute mt-[-36px]"
                    style={{
                      top: `${y - 50}px`,
                      width: `${editorWidth}px`,
                    }}
                  >
                    <div className="flex w-full justify-end bg-gradient-to-b from-transparent via-[rgba(255,255,255, 0.5)] to-white border-l border-r border-gray-200 box-border">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRemoveSnippetAtIndex(index)}
                      >
                        <X />
                      </Button>
                    </div>
                    <div
                      key={index}
                      className="relative bg-white px-8 cm-line overflow-hidden border-l border-r border-gray-200 box-border"
                      style={{
                        height: `${height}px`,
                      }}
                    >
                      {text}
                      <div className="absolute bottom-0 justify-center items-center right-0 left-0 flex bg-gradient-to-b from-transparent via-[rgba(255,255,255, 0.5)] to-white h-[25px]"></div>
                    </div>
                    <div className="flex w-full justify-center border-l border-r border-gray-200 box-border bg-gradient-to-t from-transparent via-[rgba(255,255,255, 0.5)] to-white h-[25px]">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleExpandSnippetAtIndex(index)}
                      >
                        <ChevronDown />
                      </Button>
                    </div>
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
  defaultValue?: T
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

function safelyGetCursorPosition<T>(
  doc: Doc<T>,
  cursor: A.Cursor
): number | null {
  try {
    return A.getCursorPosition(doc, ["content"], cursor);
  } catch (err) {
    return null;
  }
}
