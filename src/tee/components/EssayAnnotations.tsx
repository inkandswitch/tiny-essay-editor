import { Annotation } from "@/patchwork/schema";
import { MarkdownDocAnchor } from "../schema";
import { truncate } from "lodash";

export const EssayAnnotations = ({
  annotations,
}: {
  annotations: Annotation<MarkdownDocAnchor, string>[];
}) => {
  return (
    <div>
      {annotations.map((annotation) => {
        switch (annotation.type) {
          case "added":
            return (
              <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span className="font-serif bg-green-50 border-b border-green-400">
                  {annotation.added}
                </span>
              </div>
            );

          case "deleted":
            return (
              <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span className="font-serif bg-red-50 border-b border-red-400">
                  {annotation.deleted}
                </span>
              </div>
            );

          case "changed":
            return (
              <div className="text-sm">
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
            return (
              <div className="text-sm whitespace-nowrap overflow-ellipsis overflow-hidden">
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
