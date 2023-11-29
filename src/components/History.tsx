import { MarkdownDoc } from "../schema";
import { DocHandle } from "@automerge/automerge-repo";
import {
  Doc,
  Heads,
  Patch,
  decodeChange,
  diff,
  getAllChanges,
  getHeads,
  view,
} from "@automerge/automerge/next";
import { Viewport } from "./App";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { truncate } from "lodash";

type DocLine = {
  text: string;
  start: number;
  type: "inserted" | "deleted" | "unchanged";
  visible: boolean;
};

type Snapshot = {
  heads: Heads;
  doc: Doc<MarkdownDoc>;
  previous: Snapshot | null;
  diffFromPrevious: Patch[];
};

const snapshotsFromDoc = (doc: Doc<MarkdownDoc>): Snapshot[] => {
  const changes = getAllChanges(doc);
  const snapshots: Snapshot[] = [];

  for (let i = 1; i < changes.length; i += 500) {
    const change = decodeChange(changes[i]);
    const heads = [change.hash];
    const docAtHeads = view(doc, heads);
    const previous = snapshots[snapshots.length - 1] ?? null;
    const diffFromPrevious = previous ? diff(doc, previous.heads, heads) : [];
    snapshots.push({
      heads,
      doc: docAtHeads,
      previous,
      diffFromPrevious,
    });
  }

  return snapshots;
};

function patchOverlapsLine(start: number, end: number, patch: Patch): boolean {
  if (patch.path[0] !== "content") {
    return false;
  }

  switch (patch.action) {
    case "del": {
      return patch.path[1] < start && patch.path[1] + patch.length > end;
    }
    case "splice": {
      const spliceStart = patch.path[1];
      const spliceEnd = spliceStart + patch.value.length;

      // TODO check this logic, I just winged it; pretty sure it's wrong
      return (
        (spliceStart >= start && spliceStart < end) || // start is
        (spliceEnd > start && spliceEnd <= end) ||
        (spliceStart <= start && spliceEnd > end)
      );
    }
  }

  return false;
}

export const History: React.FC<{
  handle: DocHandle<MarkdownDoc>;
  diffHeads: Heads;
  setDiffHeads: (heads: Heads) => void;
  viewport: Viewport;
}> = ({ handle, diffHeads, setDiffHeads, viewport }) => {
  const doc = handle.docSync();
  const changes = useMemo(() => getAllChanges(doc), [doc]);
  const [expanded, setExpanded] = useState(false);

  // For now only compute the snapshots one time; TODO make live
  const snapshots = useMemo(() => snapshotsFromDoc(doc), []);

  // TODO: pass in patches from above, don't duplicate diff work?
  const patches = useMemo(
    () => diff(doc, diffHeads, getHeads(doc)),
    [doc, diffHeads]
  );

  return (
    <div>
      <div className="p-4 text-gray-500 uppercase font-medium text-sm">
        Version Control
      </div>
      <div className="p-2 border-t border-b border-gray-300">
        <div className="text-xs mb-1">
          Showing changes from{" "}
          <span className="font-bold">{diffHeads[0]?.substring(0, 6)}</span> to
          current
        </div>
        <input
          className="w-48"
          type="range"
          min="0"
          max={changes.length - 1}
          step="500"
          onChange={(e) => {
            const change = changes[e.target.value];
            setDiffHeads([decodeChange(change).hash]);
          }}
          value={changes.findIndex(
            (change) => decodeChange(change).hash === diffHeads[0]
          )}
        />
      </div>
      {!expanded && (
        <div className="flex flex-row">
          <div
            className="h-full py-48 px-2 text-gray-300 hover:text-gray-600 hover:bg-gray-200 cursor-pointer"
            onClick={() => setExpanded(true)}
          >
            <ChevronLeft />
          </div>
          <div className="pt-4">
            <MinimapWithDiff doc={doc} patches={patches} viewport={viewport} />
          </div>
        </div>
      )}
      <div
        className={`absolute top-[150px] right-20 bg-black bg-opacity-50 p-4 transition-all ${
          expanded ? " scale-x-100" : "scale-x-0 translate-x-[600px]"
        }`}
      >
        <div className="text-white mb-4">History Log</div>
        <div className="flex flex-row">
          <div
            className="h-full py-48 px-1 text-gray-300 hover:text-white  bg-black bg-opacity-20 hover:bg-opacity-50 cursor-pointer"
            onClick={() => setExpanded(false)}
          >
            <ChevronRight />
          </div>
          {snapshots.map((snapshot, i) => (
            <div className="m-2">
              <div className="text-white text-sm">
                {snapshot.heads[0].substring(0, 6)}
              </div>
              <MinimapWithDiff
                doc={snapshot.doc}
                patches={snapshot.diffFromPrevious}
                // For now make the whole doc visible;
                // we'll figure out scrolling later
                viewport={{
                  visibleStartPos: 0,
                  visibleEndPos: snapshot.doc.content.length,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MinimapWithDiff: React.FC<{
  doc: MarkdownDoc;
  patches: Patch[];
  viewport: Viewport;
}> = ({ doc, patches, viewport }) => {
  // Roughly split up the doc into 80-char lines to approximate the way it's displayed
  let currentIndex = 0;
  const linesNested = doc.content.split("\n").map((line) => {
    const lineObjects = (line.match(/.{1,80}/g) || [""]).map((text) => {
      const lineObject: DocLine = {
        text,
        start: currentIndex,
        type: "unchanged",
        visible: false,
      };

      for (const patch of patches) {
        if (
          !(
            (patch.action === "splice" || patch.action === "del") &&
            patch.path[0] === "content"
          )
        ) {
          continue;
        }
        if (
          patchOverlapsLine(currentIndex, currentIndex + text.length, patch)
        ) {
          if (patch.action === "splice") {
            lineObject.type = "inserted";
          } else if (patch.action === "del" && lineObject.type !== "inserted") {
            lineObject.type = "deleted";
          }
        }
      }

      if (
        currentIndex >= viewport.visibleStartPos &&
        currentIndex <= viewport.visibleEndPos
      ) {
        lineObject.visible = true;
      }

      currentIndex += text.length;
      return lineObject;
    });
    return lineObjects;
  });
  const lines: DocLine[] = [].concat(...linesNested);

  return (
    <div className="p-2 bg-white w-36 text-[3px] border border-gray-400 inline-block">
      {lines.map((line, i) => {
        const isHeading =
          line.text.startsWith("## ") || line.text.startsWith("# ");
        return (
          <div
            className={` select-none cursor-default w-full ${
              line.type === "inserted"
                ? "bg-green-200"
                : line.type === "deleted"
                ? "bg-red-200"
                : ""
            } ${line.visible ? "opacity-100" : "opacity-50"} ${
              isHeading ? "font-medium h-[10px]" : "h-[4px]"
            }`}
            key={i}
          >
            {isHeading ? (
              <div className="text-[10px]">
                {truncate(line.text, { length: 20 })}
              </div>
            ) : (
              <span>{line.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
