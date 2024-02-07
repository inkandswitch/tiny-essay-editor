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
import { getCursorPositionSafely } from "../utils";

interface ResolveBranch extends Branch {
  fromPos: number;
  toPos: number;
}

const EMPTY_LIST = [];

type focusMode = "none" | "sentence" | "paragraph";

interface FocusRange {
  from: A.Cursor;
  to: A.Cursor;
}

export const SideBySidePlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>(undefined);
  const [selectedHeadsIndex, setSelectedHeadsIndex] = useState(0);
  const [focusMode, setFocuseMode] = useState<focusMode>("none");
  const [focusRange, setFocusRange] = useState<FocusRange>();

  useEffect(() => {
    if (!doc || !selection || selection.from !== selection.to) {
      setFocusRange(undefined);
      return;
    }

    const paragraph = getParagraphAtPosition(doc.content, selection.from);

    if (!paragraph) {
      setFocusRange(undefined);
      return;
    }

    setFocusRange({
      from: A.getCursor(doc, ["content"], paragraph.from),
      to: A.getCursor(doc, ["content"], paragraph.to),
    });
  }, [selection?.from, selection?.to, doc?.content]);

  const headsHistory = useHeadsHistory(docUrl);
  const compareHeads =
    headsHistory[Math.max(headsHistory.length - selectedHeadsIndex, 0)];

  const compareDoc = useMemo(() => {
    if (!compareHeads) {
      return undefined;
    }

    return A.view(doc, compareHeads);
  }, [compareHeads]);

  const diffCurrent = useMemo(() => {
    if (!doc || !compareHeads) {
      return [];
    }

    return A.diff(doc, compareHeads, A.getHeads(doc));
  }, [doc, compareHeads]);

  const highlightsCurrent = useHighlights(
    diffCurrent,
    doc,
    focusMode === "paragraph" ? focusRange : undefined
  );

  const diffCompare = useMemo(() => {
    if (!doc || !compareHeads) {
      return [];
    }

    return A.diff(doc, A.getHeads(doc), compareHeads);
  }, [doc, compareHeads]);

  const highlightsCompare = useHighlights(
    diffCompare,
    compareDoc,
    focusMode === "paragraph" ? focusRange : undefined
  );

  /*if (focusRange && compareDoc) {
    console.log(
      "??",
      getCursorPositionSafely(compareDoc, ["content"], focusRange.from),

      compareDoc.content
    );
  }*/

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
              <SelectItem value="paragraph">paragraph</SelectItem>
              <SelectItem disabled value="sentence">
                sentence (not implemented)
              </SelectItem>
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
                setSelection={() => {}}
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

interface Paragraph {
  from: number;
  to: number;
  text: string;
}

function getParagraphAtPosition(
  text: string,
  index: number
): Paragraph | undefined {
  if (text.charAt(index) === "\n") {
    return undefined;
  }

  // Split the text into paragraphs
  const paragraphs = text.split("\n\n");

  // Keep track of the current index within the overall text
  let currentIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    // Determine the end index of the current paragraph
    const nextIndex =
      currentIndex + paragraphs[i].length + (i < paragraphs.length - 1 ? 2 : 0);

    // Check if the index is within the current paragraph
    if (index >= currentIndex && index < nextIndex) {
      return {
        text: paragraphs[i],
        from: currentIndex,
        to: nextIndex - 1, // Adjust because nextIndex points to the start of the next paragraph or end of text
      };
    }

    // Update the current index for the next paragraph
    currentIndex = nextIndex;
  }

  // Return a message if the index is out of bounds, along with null indices
  return;
}

function useHighlights(
  diff: A.Patch[],
  doc?: MarkdownDoc,
  focusRange?: FocusRange
) {
  return useMemo<DebugHighlight[]>(() => {
    const hightlights = diff.flatMap((patch) => {
      if (
        patch.path[0] === "content" &&
        patch.action === "splice" &&
        typeof patch.path[1] === "number"
      ) {
        const from = patch.path[1];
        const to = from + patch.value.length;

        return [
          {
            class: "text-[#D59C1E]",
            from,
            to,
          },
        ];
      }

      return [];
    });

    if (doc && focusRange) {
      const from = getCursorPositionSafely(doc, ["content"], focusRange.from);
      const to = getCursorPositionSafely(doc, ["content"], focusRange.to);

      console.log("FROM:", from, to);

      if (from !== undefined && to !== undefined) {
        if (from !== 0) {
          hightlights.push({
            from: 0,
            to: from,
            class: "text-gray-500",
          });
        }
        if (to !== doc.content.length - 1) {
          hightlights.push({
            from: to,
            to: doc.content.length,
            class: "text-gray-500",
          });
        }
      }
    }

    return hightlights;
  }, [diff, doc, focusRange]);
}
