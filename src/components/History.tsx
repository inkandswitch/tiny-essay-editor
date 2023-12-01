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
  view,
} from "@automerge/automerge/next";
import { Viewport } from "./App";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCheck,
  CheckCircle,
  CheckIcon,
  ChevronLeft,
  ChevronRight,
  Edit2Icon,
  EditIcon,
  EyeIcon,
  PencilIcon,
  TimerResetIcon,
  Undo2Icon,
} from "lucide-react";
import { isEqual, truncate } from "lodash";
import { snapshotsFromDoc } from "../utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeChanges } from "@/llm";
import Markdown from "react-markdown";
import { Button } from "./ui/button";

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
  id: string;
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

  const pushCurrentGroup = () => {
    currentGroup.diff = diff(
      doc,
      [currentGroup.changes[0].hash],
      [currentGroup.changes[currentGroup.changes.length - 1].hash]
    );
    changeGroups.push(currentGroup);
  };

  for (let i = 0; i < reversedChanges.length; i++) {
    const change = reversedChanges[i];
    const decodedChange = decodeChange(change);

    if (
      currentGroup &&
      currentGroup.actorIds[0] === decodedChange.actor &&
      currentGroup.changes.length < 1000
    ) {
      currentGroup.changes.push(decodedChange);
      currentGroup.charsAdded += decodedChange.ops.reduce((total, op) => {
        return op.action === "set" && op.insert === true ? total + 1 : total;
      }, 0);
      currentGroup.charsDeleted += decodedChange.ops.reduce((total, op) => {
        return op.action === "del" ? total + 1 : total;
      }, 0);
    } else {
      if (currentGroup) {
        pushCurrentGroup();
      }
      currentGroup = {
        id: decodedChange.hash,
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
    pushCurrentGroup();
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
  const [changeGroupDescriptions, setChangeGroupDescriptions] = useState<{
    [key: string]: string;
  }>({});
  const [reviewedGroupIds, setReviewedGroupIds] = useState<string[]>([]);

  // this is a demo hack: auto mark the last 4 changes in the list as reviewed
  useEffect(() => {
    const lastFiveChanges = groupedChanges.slice(-4);
    const lastFiveChangeIds = lastFiveChanges.map((change) => change.id);
    setReviewedGroupIds([...reviewedGroupIds, ...lastFiveChangeIds]);
  }, [groupedChanges]);

  const unreviewedGroupIds = groupedChanges
    .filter((group) => !reviewedGroupIds.includes(group.id))
    .map((group) => group.id);

  const summarizeChangesWithLLM = async () => {
    for (const group of groupedChanges) {
      console.log("CALCULATING!!!", group.id);
      const afterDoc = view(doc, [group.changes[0].hash]);
      const beforeDoc = view(doc, [
        group.changes[group.changes.length - 1].hash,
      ]);

      setChangeGroupDescriptions((prev) => ({
        ...prev,
        [group.id]: "*🪄 Autofilling...*",
      }));

      const summary = await summarizeChanges(
        beforeDoc.content ?? "Empty document",
        afterDoc.content,
        group.diff
      );
      setChangeGroupDescriptions((prev) => ({
        ...prev,
        [group.id]: summary,
      }));
    }
  };

  const snapshotStepSize = changes ? Math.ceil(changes.length / 8) : 100;
  const [expanded, setExpanded] = useState(false);

  // For now only compute the snapshots one time; TODO make live
  const snapshots = useMemo(() => snapshotsFromDoc(doc, snapshotStepSize), []);

  // TODO: pass in patches from above, don't duplicate diff work?
  const patches = useMemo(
    () => diff(doc, diffHeads, getHeads(doc)),
    [doc, diffHeads]
  );

  const activeGroupIds = useMemo(() => {
    if (isEqual(diffHeads, getHeads(doc))) return [];

    const result = [];
    for (const group of groupedChanges) {
      result.push(group.id);
      // short circuit out of the loop once we find the group that has the diff heads
      if (group.changes.some((change) => diffHeads.includes(change.hash))) {
        break;
      }
    }

    return result;
  }, [groupedChanges, diffHeads, doc]);

  return (
    <div>
      <div className="p-4 text-gray-500 uppercase font-medium text-sm">
        Version Control
      </div>
      <Tabs defaultValue="account" className="w-[460px]">
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
          <Button
            variant="outline"
            size="sm"
            className="m-2"
            onClick={() => summarizeChangesWithLLM()}
          >
            🪄 Autofill descriptions
          </Button>
          <div className="text-xs p-2">
            {activeGroupIds.length === 0 && unreviewedGroupIds.length === 0 && (
              <div className="text-gray-500">No unreviewed layers</div>
            )}
            {activeGroupIds.length === 0 && unreviewedGroupIds.length > 0 && (
              <div>
                <span className="mr-2">
                  {unreviewedGroupIds.length} unreviewed layers
                </span>
                <span
                  className="font-bold hover:cursor-pointer text-gray-500 underline mr-2"
                  onClick={() => {
                    const lastUnreviewedGroupId =
                      unreviewedGroupIds[unreviewedGroupIds.length - 1];
                    const lastUnreviewedGroup = groupedChanges.find(
                      (group) => group.id === lastUnreviewedGroupId
                    );
                    setDiffHeads([lastUnreviewedGroup.changes[0].hash]);
                  }}
                >
                  <EyeIcon className="inline-block h-4 w-4" /> Catch me up
                </span>
              </div>
            )}
            {activeGroupIds.length > 0 && (
              <div>
                <span className="mr-2">
                  Showing changes from {activeGroupIds.length} layers
                </span>
                <span
                  className="font-bold hover:cursor-pointer text-gray-500 underline mr-2"
                  onClick={() => {
                    setReviewedGroupIds((prev) => [...prev, ...activeGroupIds]);
                    setDiffHeads(getHeads(doc));
                  }}
                >
                  <CheckCircle className="inline-block h-4 w-4" /> Mark Reviewed
                </span>
                <span
                  className="font-bold hover:cursor-pointer text-gray-500 underline"
                  onClick={() => setDiffHeads(getHeads(doc))}
                >
                  <Undo2Icon className="inline-block h-4 w-4" />
                  Reset
                </span>
              </div>
            )}
          </div>
          <div className="w-4/5 relative">
            {groupedChanges.map((changeGroup) => (
              <div
                className={` group px-4 py-2 w-full overflow-hidden cursor-default border-l-4 border-l-transparent hover:border-l-gray-500 border-b border-gray-200 ${
                  activeGroupIds.includes(changeGroup.id) ? "bg-blue-100" : ""
                }`}
                data-id={changeGroup.id}
                onClick={() =>
                  setDiffHeads([
                    changeGroup.changes[changeGroup.changes.length - 1].hash,
                  ])
                }
              >
                <div className="absolute top-0 left-[-176px] hidden group-hover:block bg-gray-500 bg-opacity-30 p-4">
                  <MinimapWithDiff
                    doc={view(doc, [changeGroup.changes[0].hash])}
                    patches={changeGroup.diff}
                    viewport={{
                      visibleStartPos: 0,
                      visibleEndPos: doc.content.length,
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs">
                  <div>
                    <span className="text-green-600 font-bold mr-2">
                      +{changeGroup.charsAdded}
                    </span>
                    <span className="text-red-600 font-bold">
                      -{changeGroup.charsDeleted}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    {changeGroup.changes[0].hash.substring(0, 6)}
                    {reviewedGroupIds.includes(changeGroup.id) && (
                      <CheckCircle className="inline-block h-4 w-4 ml-1" />
                    )}
                  </div>
                </div>
                {/* todo: show who did the change. (hardcode..?) */}
                {/* <div>
                  Actors:{" "}
                  <ul>
                    {changeGroup.actorIds.map((actorId) => (
                      <li className="text-xs pl-2">
                        {actorId.substring(0, 6)}
                      </li>
                    ))}
                  </ul>
                </div> */}
                <div className="text-xs">
                  {changeGroupDescriptions[changeGroup.id] && (
                    <Markdown>
                      {changeGroupDescriptions[changeGroup.id]}
                    </Markdown>
                  )}
                  {!changeGroupDescriptions[changeGroup.id] && (
                    <div className="text-gray-500">No description</div>
                  )}
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
