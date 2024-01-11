import { MarkdownDoc } from "@/tee/schema";
import { Patch } from "@automerge/automerge/next";
import { truncate } from "lodash";

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
}> = ({ doc, patches }) => {
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
