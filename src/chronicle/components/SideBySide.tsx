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

interface ResolveBranch extends Branch {
  fromPos: number;
  toPos: number;
}

const EMPTY_LIST = [];

export const SideBySidePlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const repo = useRepo();
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [doc, changeDoc] = useDocument<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>(undefined);
  const [selectedHeadsIndex, setSelectedHeadsIndex] = useState(0);
  const [hiddenBranches, setHiddenBranches] = useState<Record<string, boolean>>(
    {}
  );

  const [combinedDoc, setCombinedDoc] = useState<MarkdownDoc>();

  const onDeleteBranchAt = (index: number) => {
    const fromCursor = doc.branches[index].from;

    changeDoc((doc) => {
      delete doc.branches[index];
    });

    setHiddenBranches((hiddenBranches) => ({
      ...hiddenBranches,
      [fromCursor]: false,
    }));
  };

  const resolvedBranches = useMemo<ResolveBranch[]>(() => {
    if (!doc?.branches) {
      return [];
    }

    return doc.branches.flatMap((branch) => {
      const fromPos = getCursorPositionSafely(
        combinedDoc,
        ["content"],
        branch.from
      );
      const toPos =
        getCursorPositionSafely(combinedDoc, ["content"], branch.to) - 1;

      return !fromPos || !toPos ? [] : [{ ...branch, fromPos, toPos }];
    });
  }, [doc?.branches, combinedDoc]);

  const onNewBranch = useCallback(() => {
    const { from, to } = selection;

    if (to === doc.content.length) {
      alert("can't create spatial branch at the end of the doc");
      return;
    }

    const overlapsWithOtherBranches = resolvedBranches.some((branch) => {
      return Math.max(branch.fromPos, from) <= Math.min(branch.toPos, to);
    });

    if (overlapsWithOtherBranches) {
      alert("can't create a spatial branch that overlaps with other branches");
      return;
    }

    const text = doc.content.slice(from, to);

    changeDoc((doc) => {
      // delete range
      A.splice(doc, ["content"], from, text.length);
    });

    // create copy of doc
    const branchDocHandle = repo.create<MarkdownDoc>();
    branchDocHandle.merge(handle);

    let fromCursor;
    let toCursor;

    // reinsert change
    branchDocHandle.change((doc) => {
      A.splice(doc, ["content"], from, 0, text);

      fromCursor = A.getCursor(doc, ["content"], from);
      // we need to select the next character otherwise the range slurps up the following character if we delete the last character in the range
      toCursor = A.getCursor(doc, ["content"], to + 1);
    });

    // create branch
    changeDoc((doc) => {
      if (!doc.branches) {
        doc.branches = [];
      }

      // create branch that points to that copy
      doc.branches.push({
        docUrl: branchDocHandle.url,
        from: fromCursor,
        to: toCursor,
      });
    });
  }, [selection, resolvedBranches]);

  const onToggleIsBranchHidden = (branch: Branch) => {
    setHiddenBranches((hiddenBranches) => ({
      ...hiddenBranches,
      [branch.from]: !hiddenBranches[branch.from],
    }));
  };

  const highlights = useMemo<DebugHighlight[]>(() => {
    return (resolvedBranches ?? [])
      .map((branch) => ({
        class: getColor(branch.from),
        from: branch.fromPos,
        to: branch.toPos,
      }))
      .filter(({ from, to }) => from !== to);
  }, [resolvedBranches]);

  // create combined doc
  useEffect(() => {
    if (!doc) {
      return;
    }

    let combinedDoc = A.init<MarkdownDoc>();
    combinedDoc = A.merge(combinedDoc, doc);

    Promise.all(
      (doc.branches ?? [])
        .filter((branch) => !hiddenBranches[branch.from])
        .map((branch) => repo.find<MarkdownDoc>(branch.docUrl).doc())
    ).then((branchDocs) => {
      for (const branchDoc of branchDocs) {
        combinedDoc = A.merge(combinedDoc, branchDoc);
      }

      setCombinedDoc(combinedDoc);
    });
  }, [hiddenBranches, doc?.branches?.length, doc]);

  const headsHistory = useHeadsHistory(docUrl);

  const compareHeads =
    headsHistory[Math.max(headsHistory.length - selectedHeadsIndex, 0)];

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="p-2 h-10 text-xs font-bold text-gray-600 bg-gray-200 border-b border-gray-400 font-mono">
        <div className="flex">
          <div className="text-xs mr-2 whitespace-nowrap">
            History scrubber:
          </div>
          <Slider
            value={[selectedHeadsIndex]}
            min={0}
            max={headsHistory.length - 1}
            step={1}
            onValueChange={(value) => setSelectedHeadsIndex(value[0])}
          />
        </div>
      </div>
      <div className="flex-grow overflow-hidden flex">
        <MarkdownEditor
          handle={handle}
          path={["content"]}
          setSelection={setSelection}
          setView={() => {}}
          setActiveThreadIds={() => {}}
          threadsWithPositions={EMPTY_LIST}
          diffStyle="normal"
        />
        <div className="border-l border-gray-100 h-full"></div>
        <MarkdownEditor
          handle={handle}
          path={["content"]}
          setSelection={setSelection}
          setView={() => {}}
          setActiveThreadIds={() => {}}
          threadsWithPositions={EMPTY_LIST}
          diffStyle="normal"
          readOnly={true}
          docHeads={compareHeads}
        />
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
