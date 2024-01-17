import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { MarkdownDoc } from "@/tee/schema";
import { Doc } from "@automerge/automerge";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { EditorView } from "@codemirror/view";
import { SelectionRange } from "@codemirror/state";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Snippet {
  from: A.Cursor;
  to: A.Cursor;
  isExpanded: boolean;
  selectedHeads: A.Heads;
}

interface ResolvedSnippet {
  from: number;
  to: number;
  y: number;
  height: number;
  isExpanded: boolean;
  versions: SnippetVersion[];
  selectedVersion: SnippetVersion;
}

interface SnippetVersion {
  heads: A.Heads;
  text: string;
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

  const onOpenSnippet = (range: SelectionRange) => {
    const doc = handle.docSync();

    const from = A.getCursor(doc, ["content"], range.from - 1);
    const to = A.getCursor(doc, ["content"], range.to + 1);

    setSnippets((snippets) =>
      snippets.concat({
        from,
        to,
        isExpanded: true,
        selectedHeads: A.getHeads(doc),
      })
    );
  };

  const onRemoveSnippetAtIndex = (indexToDelete: number) => {
    setSnippets((snippets) =>
      snippets.filter((snippet, index) => index !== indexToDelete)
    );
  };

  const onToggleExpandSnippetAtIndex = (indexToToggle: number) => {
    setSnippets((snippets) =>
      snippets.map((snippet, index) =>
        index === indexToToggle
          ? { ...snippet, isExpanded: !snippet.isExpanded }
          : snippet
      )
    );
  };

  const onSelectVersionOfSnippetAtIndex = (indexToChange, version) => {
    setSnippets((snippets) =>
      snippets.map((snippet, index) =>
        index === indexToChange
          ? { ...snippet, selectedHeads: version.heads }
          : snippet
      )
    );
  };

  const resolvedSnippets: ResolvedSnippet[] = useMemo(() => {
    const resolvedSnippets: ResolvedSnippet[] = [];

    for (const snippet of snippets) {
      let tempDoc = A.init<MarkdownDoc>();
      let changes = A.getChanges(tempDoc, doc);

      let versions: SnippetVersion[] = [];
      let prevText;

      const from = safelyGetCursorPosition(doc, snippet.from);
      const to = safelyGetCursorPosition(doc, snippet.to);

      if (from === null || to === null) {
        continue;
      }

      changes.forEach((change) => {
        [tempDoc] = A.applyChanges(tempDoc, [change]);
        let heads = A.getHeads(tempDoc);

        const fromInTempDoc = safelyGetCursorPosition(tempDoc, snippet.from);
        const toInTempDoc = safelyGetCursorPosition(tempDoc, snippet.to);

        if (fromInTempDoc !== null && toInTempDoc !== null) {
          const text = tempDoc.content.slice(
            fromInTempDoc + 1,
            toInTempDoc - 1
          );

          if (text !== prevText) {
            versions.unshift({ heads, text });
            prevText = text;
          }
        }
      });

      const fromY = editorView.coordsAtPos(from).top;
      const toY = editorView.coordsAtPos(to).bottom;

      resolvedSnippets.push({
        from,
        to,
        y: fromY,
        height: toY - fromY,
        isExpanded: true,
        versions,
        selectedVersion: versions.find((v) =>
          arraysEqual(v.heads, snippet.selectedHeads)
        ),
      });
    }

    return resolvedSnippets;
  }, [snippets, doc]);

  console.log({ resolvedSnippets, snippets });

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
        class: "cm-patch-pencil",
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
                onOpenSnippet={onOpenSnippet}
                debugHighlights={debugHighlights}
              />
            </div>
            <div className="relative">
              {resolvedSnippets.map((snippet, index) => (
                <SnippetView
                  key={index}
                  snippet={snippet}
                  editorWidth={editorWidth}
                  onRemoveSnippet={() => onRemoveSnippetAtIndex(index)}
                  onToggleExpand={() => onToggleExpandSnippetAtIndex(index)}
                  onSelectVersion={(version) =>
                    onSelectVersionOfSnippetAtIndex(index, version)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SnippetViewProps {
  snippet: ResolvedSnippet;
  editorWidth: number;
  onRemoveSnippet: () => void;
  onToggleExpand: () => void;
  onSelectVersion: (version: SnippetVersion) => void;
}

function SnippetView({
  snippet,
  editorWidth,
  onRemoveSnippet,
  onToggleExpand,
  onSelectVersion,
}: SnippetViewProps) {
  const { versions, y, height, isExpanded, selectedVersion } = snippet;
  const [hoveredVersion, setHoveredVersion] = useState<SnippetVersion>();

  const onMouseOverVersionAtIndex = (index: number) => {
    setHoveredVersion(versions[index]);
  };

  const onMouseLeaveVersionAtIndex = (index: number) => {
    setHoveredVersion(undefined);
  };

  const activeVersion = hoveredVersion ?? selectedVersion;

  return (
    <div
      className="left-4 absolute mt-[-36px]"
      style={{
        top: `${y - 50}px`,
        width: `${editorWidth}px`,
      }}
    >
      <div className="flex w-full justify-between bg-gradient-to-b from-transparent via-[rgba(255,255,255, 0.5)] to-white border-l border-r border-gray-200 box-border items-center px-8">
        <div className="flex min-w-0 overflow-auto no-scrollbar">
          {versions.map((version, index) => {
            const isActive = version === activeVersion;

            return (
              <button
                onMouseOver={() => onMouseOverVersionAtIndex(index)}
                onMouseLeave={() => onMouseLeaveVersionAtIndex(index)}
                onClick={() => onSelectVersion(version)}
                key={index}
                className="p-0.5"
              >
                <div
                  className={`w-[16px] h-[16px] rounded-full flex-shrink-0 ${
                    isActive ? "bg-black" : "bg-gray-500"
                  }`}
                ></div>
              </button>
            );
          })}
        </div>

        <Button size="sm" variant="ghost" onClick={() => onRemoveSnippet()}>
          <X />
        </Button>
      </div>
      <div
        className="relative bg-white px-8 cm-line overflow-hidden border-l border-r border-gray-200 box-border"
        style={{
          height: isExpanded ? "" : `${height}px`,
        }}
      >
        <div className="whitespace-pre-wrap">{activeVersion?.text}</div>
        {!isExpanded && (
          <div className="absolute bottom-0 justify-center items-center right-0 left-0 flex bg-gradient-to-b from-transparent via-[rgba(255,255,255, 0.5)] to-white h-[25px]"></div>
        )}
      </div>
      <div className="flex w-full justify-center border-l border-r border-gray-200 box-border bg-gradient-to-t from-transparent via-[rgba(255,255,255, 0.5)] to-white h-[25px]">
        <Button size="sm" variant="ghost" onClick={() => onToggleExpand()}>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>
    </div>
  );
}

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

function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}
