import { MarkdownDoc } from "@/tee/schema";
import { Patch } from "@automerge/automerge/next";
import { truncate } from "lodash";
import { Heading, extractHeadings } from "../groupChanges";

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

type DocLine = {
  text: string;
  start: number;
  type: "inserted" | "deleted" | "unchanged";
  visible: boolean;
};

export const MinimapWithDiff: React.FC<{
  doc: MarkdownDoc;
  patches: Patch[];
  size?: "normal" | "compact";
}> = ({ doc, patches, size }) => {
  // Roughly split up the doc into 80-char lines to approximate the way it's displayed
  let currentIndex = 0;
  const linesNested = (doc.content ?? "").split("\n").map((line) => {
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

      currentIndex += text.length;
      return lineObject;
    });
    return lineObjects;
  });
  const lines: DocLine[] = [].concat(...linesNested);

  return (
    <div
      className={`p-2 w-36 bg-white ${
        size === "compact" ? "text-[2px]" : " text-[3px]"
      } border border-gray-400 inline-block  transition-all ease-in-out`}
    >
      {lines.map((line, i) => {
        const isHeading =
          line.text.startsWith("## ") || line.text.startsWith("# ");
        return (
          <div
            className={` overflow-visible select-none cursor-default w-full ${
              line.type === "inserted"
                ? "bg-green-300"
                : line.type === "deleted"
                ? "bg-red-300"
                : ""
            } ${line.visible ? "opacity-100" : "opacity-50"} ${
              isHeading
                ? "font-medium h-[10px]"
                : size === "compact"
                ? "h-[1px]"
                : "h-[4px]"
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

type BucketedPatches = Array<{
  startIndex: number;
  patches: Patch[];
  headings: Heading[];
}>;

const NUM_BUCKETS = 25;

/* Bucket patches based on their spatial location in the document. */
const bucketPatches = (doc: MarkdownDoc, patches: Patch[]): BucketedPatches => {
  const bucketSize = Math.ceil(doc.content.length / NUM_BUCKETS);
  const buckets: BucketedPatches = Array.from({ length: NUM_BUCKETS }, () => ({
    startIndex: 0,
    patches: [],
    headings: [],
    headingsEdited: false,
  }));

  const headings = extractHeadings(doc, patches);

  for (let i = 0; i < NUM_BUCKETS; i++) {
    buckets[i].startIndex = i * bucketSize;
    headings.forEach((heading) => {
      if (
        heading.index >= buckets[i].startIndex &&
        heading.index < buckets[i].startIndex + bucketSize
      ) {
        buckets[i].headings.push(heading);
      }
    });
  }

  patches.forEach((patch) => {
    let patchStart: number, patchEnd: number;
    switch (patch.action) {
      case "del": {
        patchStart = patch.path[1];
        patchEnd = patchStart + patch.length;
        break;
      }
      case "splice": {
        patchStart = patch.path[1];
        patchEnd = patchStart + patch.value.length;
        break;
      }
      default: {
        return;
      }
    }

    const startBucket = Math.floor(patchStart / bucketSize);
    const endBucket = Math.min(
      Math.floor(patchEnd / bucketSize),
      NUM_BUCKETS - 1
    );

    for (let i = startBucket; i <= endBucket; i++) {
      buckets[i].patches.push(patch);
    }
  });

  return buckets;
};

export const HorizontalMinimap: React.FC<{
  doc: MarkdownDoc;
  patches: Patch[];
}> = ({ doc, patches }) => {
  const buckets = bucketPatches(doc, patches);

  const headingsExist = buckets.filter((b) => b.headings.length > 0).length > 0;

  return (
    <div className={`${headingsExist && "mt-10"}`}>
      <div className="flex flex-row w-[75%]">
        {buckets.map((bucket) => (
          <div className="relative w-[4%]">
            {bucket.headings.length > 0 && (
              <div
                className={`absolute top-[-20px] left-0 text-xs text-gray-500 min-w-[100px] transform -rotate-[20deg] origin-left font-narrow bg-white bg-opacity-70 ${
                  bucket.headings.find((h) => h.patches.length > 0)
                    ? "font-semibold"
                    : "opacity-30 font-normal"
                }`}
              >
                {truncate(bucket.headings.map((h) => h.text).join(", "), {
                  length: 20,
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="h-3 flex flex-row border border-gray-400 rounded-md w-[75%]">
        {buckets.map((bucket) => {
          let color = "";
          if (
            bucket.patches.filter((patch) => patch.action === "splice").length >
            0
          ) {
            color = "bg-green-300";
          } else if (
            bucket.patches.filter((patch) => patch.action === "del").length > 0
          ) {
            color = "bg-red-300";
          }
          return (
            <div
              className={`relative w-[4%] ${color} ${
                bucket.headings.length > 0 && "border-l border-gray-500"
              }`}
            ></div>
          );
        })}
      </div>
    </div>
  );
};
