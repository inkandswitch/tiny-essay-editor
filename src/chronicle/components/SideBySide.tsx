import { DebugHighlight } from "@/tee/codemirrorPlugins/DebugHighlight";
import { MarkdownEditor, TextSelection } from "@/tee/components/MarkdownEditor";
import { Branch, MarkdownDoc } from "@/tee/schema";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useHeadsHistory } from "../utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hash } from "./Hash";

interface ResolveBranch extends Branch {
  fromPos: number;
  toPos: number;
}

const EMPTY_LIST = [];

type focusMode = "none" | "sentence" | "paragraph";

export const SideBySidePlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [doc] = useDocument(docUrl);
  const [selection, setSelection] = useState<TextSelection>(undefined);
  const [selectedHeadsIndex, setSelectedHeadsIndex] = useState(0);
  const [focusMode, setFocuseMode] = useState<focusMode>("none");

  console.log(selection);

  const headsHistory = useHeadsHistory(docUrl);
  const compareHeads =
    headsHistory[Math.max(headsHistory.length - selectedHeadsIndex, 0)];

  const diffCurrent = useMemo(() => {
    if (!doc || !compareHeads) {
      return [];
    }

    return A.diff(doc, compareHeads, A.getHeads(doc));
  }, [doc, compareHeads]);

  const highlightsCurrent = useMemo<DebugHighlight[]>(() => {
    return diffCurrent.flatMap((patch) => {
      if (
        patch.path[0] === "content" &&
        patch.action === "splice" &&
        typeof patch.path[1] === "number"
      ) {
        const from = patch.path[1];
        const to = from + patch.value.length;

        return [
          {
            class: "font-bold",
            from,
            to,
          },
        ];
      }

      return [];
    });
  }, [diffCurrent]);

  const diffCompare = useMemo(() => {
    if (!doc || !compareHeads) {
      return [];
    }

    return A.diff(doc, A.getHeads(doc), compareHeads);
  }, [doc, compareHeads]);

  const highlightsCompare = useMemo<DebugHighlight[]>(() => {
    return diffCompare.flatMap((patch) => {
      if (
        patch.path[0] === "content" &&
        patch.action === "splice" &&
        typeof patch.path[1] === "number"
      ) {
        const from = patch.path[1];
        const to = from + patch.value.length;

        return [
          {
            class: "font-bold",
            from,
            to,
          },
        ];
      }

      return [];
    });
  }, [diffCompare]);

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="p-2 h-10 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
        <div className="flex items-center gap-2">
          <div className="text-xs whitespace-nowrap">History scrubber:</div>
          <Slider
            value={[selectedHeadsIndex]}
            min={0}
            max={headsHistory.length - 1}
            step={1}
            onValueChange={(value) => setSelectedHeadsIndex(value[0])}
          />
          <div className="text-xs whitespace-nowrap">Focus mode:</div>
          <Select
            value={focusMode}
            onValueChange={(value) => setFocuseMode(value as any)}
          >
            <SelectTrigger className="h-6 text-xs mr-2 max-w-36">
              <SelectValue placeholder="View Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">none</SelectItem>
              <SelectItem value="sentence">sentence</SelectItem>
              <SelectItem value="paragraph">paragraph</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex-grow overflow-auto flex">
        <div className="relative flex-1">
          <div className="absolute right-2 top-2">
            <div className="inline-flex items-center border border-gray-300 rounded-full py-1 px-2">
              current
            </div>
          </div>
          <MarkdownEditor
            handle={handle}
            path={["content"]}
            setSelection={setSelection}
            setView={() => {}}
            setActiveThreadIds={() => {}}
            threadsWithPositions={EMPTY_LIST}
            debugHighlights={highlightsCurrent}
            diffStyle="normal"
          />
        </div>
        <div className="border-l border-gray-100 h-full"></div>
        <div className="relative flex-1">
          {compareHeads !== undefined && (
            <>
              <div className="absolute absolute right-2 top-2">
                <Hash hash={compareHeads ? compareHeads[0] : ""} />
              </div>
              <MarkdownEditor
                handle={handle}
                path={["content"]}
                setSelection={setSelection}
                setView={() => {}}
                setActiveThreadIds={() => {}}
                threadsWithPositions={EMPTY_LIST}
                debugHighlights={highlightsCompare}
                diffStyle="normal"
                readOnly={true}
                docHeads={compareHeads}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function getColor(hash: string) {
  // Array of Tailwind CSS color classes rearranged to not follow hue order
  const colors = [
    "bg-teal-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-lime-500",
    "bg-red-500",
    "bg-sky-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-green-500",
    "bg-indigo-500",
    "bg-yellow-500",
    "bg-pink-500",
    "bg-gray-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-fuchsia-500",
  ];

  // Convert hash to a numerical index
  let index = 0;
  for (let i = 0; i < hash.length; i++) {
    index += hash.charCodeAt(i);
  }

  // Use the modulo operator with the colors array length to select a color
  return colors[index % colors.length];
}

function getCursorPositionSafely(
  doc: A.Doc<unknown>,
  path: A.Prop[],
  cursor: A.Cursor
): number | null {
  try {
    return A.getCursorPosition(doc, path, cursor);
  } catch (err) {
    return null;
  }
}
