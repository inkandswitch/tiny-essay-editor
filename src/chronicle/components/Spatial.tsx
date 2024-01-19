import {
  ChangeGroup,
  GROUPINGS,
  GROUPINGS_THAT_TAKE_BATCH_SIZE,
  GROUPINGS_THAT_TAKE_GAP_TIME,
  getGroupedChanges,
} from "@/chronicle/groupChanges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { MarkdownDoc } from "@/tee/schema";
import { next as A, Doc } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument, useHandle } from "@automerge/automerge-repo-react-hooks";
import { SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";

interface Snippet {
  from: A.Cursor;
  to: A.Cursor;
  selectedHeads: A.Heads;
}

export interface SnippetWithVersions {
  from: A.Cursor;
  to: A.Cursor;
  versions: SnippetVersion[];
  selectedVersion: SnippetVersion;
}

export interface SnippetsWithVersionsAndResolvedPos
  extends SnippetWithVersions {
  from: number;
  to: number;
}

export interface SnippetVersion {
  heads: A.Heads;
  changeGroup: ChangeGroup;
  from: number;
  to: number;
  text: string;
}

const MAX_BATCH_SIZE = 2000;
const MAX_GAP = 300;

export const SpatialHistoryPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [editorView, setEditorView] = useState<EditorView>();
  const editorRef = useRef<HTMLDivElement>(null);

  // The grouping algorithm to use for the change log (because this is a playground!)
  const [activeGroupingAlgorithm, setActiveGroupingAlgorithm] =
    useState<keyof typeof GROUPINGS>("ByCharCount");

  // Some grouping algorithms have a batch size parameter.
  // we can set this using a slider in the UI.
  const [groupingNumericParameter, setGroupingNumericParameter] =
    useState<number>(1000);

  const debouncedGroupingNumericParameter = useDebounce(
    groupingNumericParameter
  );

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
        selectedHeads: A.getHeads(doc),
      })
    );
  };

  const onCloseSnippetAtIndex = (indexToClose: number) => {
    console.log("close");

    setSnippets((snippets) =>
      snippets.filter((snippet, index) => index !== indexToClose)
    );
  };

  const snippetsWithVersions: SnippetWithVersions[] = useMemo(() => {
    const snippetsWithVersions: SnippetWithVersions[] = [];

    for (const snippet of snippets) {
      let tempDoc = A.init<MarkdownDoc>();

      const { changeGroups } = getGroupedChanges(doc, {
        algorithm: activeGroupingAlgorithm,
        numericParameter: groupingNumericParameter,
        tags: doc.tags ?? [],
      });

      let versions: SnippetVersion[] = [];
      let prevText;

      const from = safelyGetCursorPosition(doc, snippet.from);
      const to = safelyGetCursorPosition(doc, snippet.to);

      if (from === null || to === null) {
        continue;
      }

      changeGroups.forEach((changeGroup: ChangeGroup) => {
        [tempDoc] = A.applyChanges(
          tempDoc,
          changeGroup.changes.map(A.encodeChange)
        );
        let heads = A.getHeads(tempDoc);

        const fromInTempDoc = safelyGetCursorPosition(tempDoc, snippet.from);
        const toInTempDoc = safelyGetCursorPosition(tempDoc, snippet.to);

        if (fromInTempDoc !== null && toInTempDoc !== null) {
          const text = tempDoc.content.slice(
            fromInTempDoc + 1,
            toInTempDoc - 1
          );

          if (text !== prevText) {
            versions.unshift({
              heads,
              text,
              from: fromInTempDoc,
              to: toInTempDoc,
              changeGroup,
            });
            prevText = text;
          }
        }
      });

      snippetsWithVersions.push({
        from: snippet.from,
        to: snippet.to,
        versions,
        selectedVersion: versions[0],
      });
    }

    return snippetsWithVersions;
  }, [snippets, debouncedGroupingNumericParameter, activeGroupingAlgorithm]);

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

  const snippetsWithVersionsAndResolvedPos = useMemo(
    () =>
      snippetsWithVersions.map((snippet) => ({
        ...snippet,
        from: A.getCursorPosition(doc, ["content"], snippet.from),
        to: A.getCursorPosition(doc, ["content"], snippet.to),
      })),
    [snippetsWithVersions, doc]
  );

  return (
    <div className="flex flex-col overflow-y-hidden h-full ">
      <div className="p-2 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono flex gap-3">
        <div className="flex items-center gap-2">
          <div className="text-xs whitespace-nowrap">Group by</div>

          <Select
            value={activeGroupingAlgorithm}
            onValueChange={(value) => setActiveGroupingAlgorithm(value as any)}
          >
            <SelectTrigger className="h-6 text-xs">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(GROUPINGS).map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {GROUPINGS_THAT_TAKE_BATCH_SIZE.includes(activeGroupingAlgorithm) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs whitespace-nowrap">Batch size</div>
            <Slider
              defaultValue={[groupingNumericParameter]}
              min={1}
              max={MAX_BATCH_SIZE}
              step={1}
              onValueChange={(value) => setGroupingNumericParameter(value[0])}
              className="flex-shrink-0"
            />
            <input
              type="number"
              min={1}
              max={MAX_BATCH_SIZE}
              value={groupingNumericParameter}
              onChange={(e) =>
                setGroupingNumericParameter(parseInt(e.target.value))
              }
            />
          </div>
        )}

        {GROUPINGS_THAT_TAKE_GAP_TIME.includes(activeGroupingAlgorithm) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs whitespace-nowrap">Max gap (s)</div>
            <Slider
              defaultValue={[groupingNumericParameter]}
              max={MAX_GAP}
              min={1}
              step={1}
              onValueChange={(value) => setGroupingNumericParameter(value[0])}
              className="flex-shrink-0"
            />
            <input
              type="number"
              min={1}
              max={MAX_GAP}
              value={groupingNumericParameter}
              onChange={(e) =>
                setGroupingNumericParameter(parseInt(e.target.value))
              }
            />
          </div>
        )}

        <div className="flex items-center"></div>
      </div>
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
                onCloseSnippet={onCloseSnippetAtIndex}
                snippets={snippetsWithVersionsAndResolvedPos}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

export function useDebounce<T>(value: T, delay?: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay || 500);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
