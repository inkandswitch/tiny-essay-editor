import { Annotation } from "@/patchwork/schema";
import { MarkdownDocAnchor } from "../schema";
import { truncate } from "lodash";

export const EssayAnnotations = ({
  annotations,
}: {
  annotations: Annotation<MarkdownDocAnchor, string>[];
}) => {
  return (
    <div className="px-2 py-1 border border-gray-200 rounded-sm">
      {annotations.map((annotation) => {
        switch (annotation.type) {
          case "added":
            return (
              <div className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span className="font-serif bg-green-50 border-b border-green-400">
                  {annotation.added}
                </span>
              </div>
            );

          case "deleted":
            return (
              <div className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span className="font-serif bg-red-50 border-b border-red-400">
                  {annotation.deleted}
                </span>
              </div>
            );

          case "changed":
            return (
              <div className="text-md">
                <span className="font-serif bg-red-50 border-b border-red-400">
                  {truncate(annotation.before, { length: 45 })}
                </span>{" "}
                →{" "}
                <span className="font-serif bg-green-50 border-b border-green-400">
                  {truncate(annotation.after, { length: 45 })}
                </span>
              </div>
            );

          case "highlighted":
            if (annotation.value.length === 0) {
              return (
                <div className="text-xs text-gray-500 italic">
                  No text selected
                </div>
              );
            }
            return (
              <div className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span className="font-serif bg-yellow-50 border-b border-yellow-400">
                  {annotation.value}
                </span>
              </div>
            );
        }
      })}
    </div>
  );
};
