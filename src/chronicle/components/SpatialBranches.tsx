import { Button } from "@/components/ui/button";
import { DebugHighlight } from "@/tee/codemirrorPlugins/DebugHighlight";
import { TextSelection } from "@/tee/components/MarkdownEditor";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { Branch, MarkdownDoc } from "@/tee/schema";
import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import clsx from "clsx";
import { PlusIcon, X } from "lucide-react";
import React, { useState, useMemo } from "react";

export const SpatialBranchesPlayground: React.FC<{ docUrl: AutomergeUrl }> = ({
  docUrl,
}) => {
  const handle = useHandle<MarkdownDoc>(docUrl);
  const [doc] = useDocument<MarkdownDoc>(docUrl);
  const [selection, setSelection] = useState<TextSelection>(undefined);
  const [hiddenBranches, setHiddenBranches] = useState<Record<string, boolean>>(
    {}
  );

  const onDeleteBranchAt = (index: number) => {
    const fromCursor = doc.branches[index].from;

    handle.change((doc) => {
      delete doc.branches[index];
    });

    setHiddenBranches((hiddenBranches) => ({
      ...hiddenBranches,
      [fromCursor]: false,
    }));
  };

  const onNewBranch = () => {
    const { from, to } = selection;

    if (to === doc.content.length) {
      alert("can't create spatial branch at the end of the doc");
      return;
    }

    const overlapsWithOtherBranches =
      doc.branches &&
      doc.branches.some((branch) => {
        const branchFrom = A.getCursorPosition(doc, ["content"], branch.from);
        const branchTo = A.getCursorPosition(doc, ["content"], branch.to) - 1;

        return Math.max(branchFrom, from) <= Math.min(branchTo, to);
      });

    if (overlapsWithOtherBranches) {
      alert("can't create a spatial branch that overlaps with other branches");
      return;
    }

    // todo: this doesn't work
    const text = doc.content.slice(from, to);

    const headsToForkAt = A.getHeads(doc);

    handle.change((doc) => {
      A.splice(doc, ["content"], from, text.length);
    });

    const branchHeads = handle.changeAt(headsToForkAt, (doc) => {
      A.splice(doc, ["content"], to, 0, text);
    });

    handle.change((doc) => {
      if (!doc.branches) {
        doc.branches = [];
      }

      doc.branches.push({
        heads: branchHeads,
        from: A.getCursor(A.view(doc, branchHeads), ["content"], from),

        // we need to select the next character otherwise the range slurps up the following character if we delete the last character in the range
        to: A.getCursor(A.view(doc, branchHeads), ["content"], to + 1),
      });
    });
  };

  const onToggleIsBranchHidden = (branch: Branch) => {
    setHiddenBranches((hiddenBranches) => ({
      ...hiddenBranches,
      [branch.from]: !hiddenBranches[branch.from],
    }));
  };

  const highlights = useMemo<DebugHighlight[]>(() => {
    if (!doc) {
      return [];
    }

    return (doc.branches ?? [])
      .map((branch, index) => ({
        class: getColor(branch.from),
        from: A.getCursorPosition(doc, ["content"], branch.from),
        to: A.getCursorPosition(doc, ["content"], branch.to) - 1,
      }))
      .filter(({ from, to }) => from !== to);
  }, [doc?.branches, doc?.content]);

  return (
    <div className="flex overflow-hidden h-full ">
      <div className="w-72 border-r border-gray-200 overflow-hidden flex flex-col font-mono text-xs font-semibold text-gray-600">
        <div className="">
          <div className="flex items-center m-2">
            <div className="p-1 text-xs text-gray-500 uppercase font-bold mb-1">
              Branches
            </div>

            <div className="ml-auto mr-1">
              <Button
                className=""
                variant="outline"
                size="sm"
                onClick={onNewBranch}
                disabled={!selection}
              >
                <PlusIcon className="mr-2" size={12} />
                New branch
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-grow border-t border-gray-400 flex flex-col gap-2 p-2">
            {(doc?.branches ?? []).map((branch, index) => (
              <div className="flex gap-1 items-center" key={branch.from}>
                <input
                  type="checkbox"
                  checked={!hiddenBranches[branch.from]}
                  onChange={() => onToggleIsBranchHidden(branch)}
                />

                <div
                  className={clsx(
                    `shadow flex items-center w-fit py-1 px-2 text-black`,
                    getColor(branch.from),
                    {
                      "opacity-50": hiddenBranches[branch.from],
                    }
                  )}
                  style={{
                    transform: `rotate(${((index * 137) % 7) - 3}deg)`,
                  }}
                >
                  Branch #{index}{" "}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDeleteBranchAt(index)}
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-hidden">
        <TinyEssayEditor
          docUrl={docUrl}
          key={docUrl}
          debugHighlights={highlights}
          onChangeSelection={setSelection}
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
