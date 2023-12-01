import { MarkdownDoc, Snapshot } from "../schema";
import { DocHandle } from "@automerge/automerge-repo";
import {
  ActorId,
  Change,
  DecodedChange,
  Doc,
  Heads,
  Patch,
  decodeChange,
  diff,
  getAllChanges,
  getHeads,
} from "@automerge/automerge/next";
import { Viewport } from "./App";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { reverse, truncate, uniq } from "lodash";
import { snapshotsFromDoc } from "../utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DocLine = {
  text: string;
  start: number;
  type: "inserted" | "deleted" | "unchanged";
  visible: boolean;
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

type ChangeGroup = {
  changes: DecodedChange[];
  actorIds: ActorId[];
  charsAdded: number;
  charsDeleted: number;
  diff: Patch[];
};

const groupChanges = (changes: Change[], doc: Doc<MarkdownDoc>) => {
  const reversedChanges = [...changes].reverse();
  const changeGroups: ChangeGroup[] = [];

  let currentGroup: ChangeGroup | null = null;

  for (const change of reversedChanges) {
    const decodedChange = decodeChange(change);

    if (currentGroup && currentGroup.actorIds[0] === decodedChange.actor) {
      currentGroup.changes.push(decodedChange);
      currentGroup.charsAdded += decodedChange.ops.reduce((total, op) => {
        return op.action === "set" && op.insert === true ? total + 1 : total;
      }, 0);
      currentGroup.charsDeleted += decodedChange.ops.reduce((total, op) => {
        return op.action === "del" ? total + 1 : total;
      }, 0);
    } else {
      if (currentGroup) {
        currentGroup.diff = diff(
          doc,
          [currentGroup.changes[0].hash],
          [currentGroup.changes[currentGroup.changes.length - 1].hash]
        );
        changeGroups.push(currentGroup);
      }
      currentGroup = {
        changes: [decodedChange],
        actorIds: [decodedChange.actor],
        charsAdded: decodedChange.ops.reduce((total, op) => {
          return op.action === "set" && op.insert === true ? total + 1 : total;
        }, 0),
        charsDeleted: decodedChange.ops.reduce((total, op) => {
          return op.action === "del" ? total + 1 : total;
        }, 0),
        diff: [],
      };
    }
  }

  if (currentGroup) {
    currentGroup.diff = diff(
      doc,
      [currentGroup.changes[0].hash],
      [currentGroup.changes[currentGroup.changes.length - 1].hash]
    );
    changeGroups.push(currentGroup);
  }

  return changeGroups;

  // an older thing where we batched by 500 at a time

  // for (let i = 0; i < changes.length; i += 500) {
  //   const batch = changes.slice(i, i + 500);
  //   const changesInBatch = batch.map((change) => decodeChange(change));
  //   const actorIds = uniq(changesInBatch.map((change) => change.actor));

  //   // HACK: this is a very crude way to count chars... not generalized.
  //   // a char was added if an op has action: "set", insert: true.
  //   // a char was deleted if an op has action: "del"

  //   const charsAdded = changesInBatch
  //     .flatMap((change) => change.ops)
  //     .reduce((total, op) => {
  //       return op.action === "set" && op.insert === true ? total + 1 : total;
  //     }, 0);

  //   const charsDeleted = changesInBatch
  //     .flatMap((change) => change.ops)
  //     .reduce((total, op) => {
  //       return op.action === "del" ? total + 1 : total;
  //     }, 0);

  //   changeGroups.push({
  //     changes: changesInBatch,
  //     actorIds,
  //     charsAdded,
  //     charsDeleted,
  //   });
  // }

  // changeGroups.reverse();
  // return changeGroups;
};

export const History: React.FC<{
  handle: DocHandle<MarkdownDoc>;
  diffHeads: Heads;
  setDiffHeads: (heads: Heads) => void;
  viewport: Viewport;
  setSnapshot: (snapshot: Snapshot) => void;
}> = ({ handle, diffHeads, setDiffHeads, viewport, setSnapshot }) => {
  const doc = handle.docSync();
  const changes = useMemo(() => getAllChanges(doc), [doc]);
  const groupedChanges = useMemo(
    () => groupChanges(changes, doc),
    [changes, doc]
  );

  const snapshotStepSize = changes ? Math.ceil(changes.length / 8) : 100;
  const [expanded, setExpanded] = useState(false);

  // For now only compute the snapshots one time; TODO make live
  const snapshots = useMemo(() => snapshotsFromDoc(doc, snapshotStepSize), []);

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
      <Tabs defaultValue="account" className="w-[400px]">
        <TabsList>
          <TabsTrigger value="minimap">Minimap</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>
        <TabsContent value="minimap">
          <div className="p-2 border-t border-b border-gray-300">
            <div className={`text-xs mb-1 ${expanded ? "opacity-30" : ""}`}>
              Showing changes from{" "}
              <span className="font-bold">{diffHeads[0]?.substring(0, 6)}</span>{" "}
              to current
            </div>
            <input
              className="w-48"
              type="range"
              min="0"
              max={changes.length - 1}
              step={snapshotStepSize}
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
                <MinimapWithDiff
                  doc={doc}
                  patches={patches}
                  viewport={viewport}
                />
              </div>
            </div>
          )}
          <div
            className={`absolute top-[60px] right-20 bg-black bg-opacity-50 p-4 transition-all ${
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
                <div
                  className=" m-2 opacity-80 hover:opacity-100"
                  onMouseEnter={() => setSnapshot(snapshot)}
                >
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
        </TabsContent>
        <TabsContent value="changelog">
          <div className="w-64 relative">
            {groupedChanges.map((changeGroup) => (
              <div className="group m-2 p-2 border border-gray-300 w-full overflow-hidden cursor-default hover:bg-gray-200">
                <div className="text-xs text-gray-500">
                  {changeGroup.changes[0].hash.substring(0, 6)} ~{" "}
                  {changeGroup.changes[
                    changeGroup.changes.length - 1
                  ].hash.substring(0, 6)}
                </div>
                <div>
                  <span className="text-green-600 text-sm mr-2">
                    +{changeGroup.charsAdded}
                  </span>
                  <span className="text-red-600 text-sm">
                    -{changeGroup.charsDeleted}
                  </span>
                </div>
                <div>
                  Actors:{" "}
                  <ul>
                    {changeGroup.actorIds.map((actorId) => (
                      <li className="text-xs pl-2">
                        {actorId.substring(0, 6)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="absolute top-0 left-[-150px] hidden group-hover:block">
                  <MinimapWithDiff
                    doc={doc}
                    patches={changeGroup.diff}
                    viewport={{
                      visibleStartPos: 0,
                      visibleEndPos: doc.content.length,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
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
    <div className="p-2 bg-white w-36 text-[3px]  border border-gray-400 inline-block  transition-all ease-in-out">
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
