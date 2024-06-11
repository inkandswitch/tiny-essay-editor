import { truncate } from "lodash";
import { AnnotationsViewProps } from "@/os/tools";
import { MarkdownDoc, MarkdownDocAnchor } from "../datatype";

export const EssayAnnotations = ({
  annotations,
}: AnnotationsViewProps<MarkdownDoc, MarkdownDocAnchor, string>) => {
  return (
    <div className="px-2 bg-white rounded-sm">
      {annotations.map((annotation, index) => {
        switch (annotation.type) {
          case "added":
            return (
              <div
                className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden"
                key={index}
              >
                <span className="font-serif bg-green-50 border-b border-green-400">
                  {annotation.added.replace(/ /g, "\u00A0")}
                </span>
              </div>
            );

          case "deleted":
            return (
              <div
                className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden"
                key={index}
              >
                <span className="font-serif bg-red-50 border-b border-red-400">
                  {annotation.deleted}
                </span>
              </div>
            );

          case "changed":
            return (
              <div className="text-md" key={index}>
                <span className="font-serif bg-red-50 border-b border-red-400">
                  {truncate(annotation.before.replace(/ /g, "\u00A0"), {
                    length: 45,
                  })}
                </span>{" "}
                →{" "}
                <span className="font-serif bg-green-50 border-b border-green-400">
                  {truncate(annotation.after.replace(/ /g, "\u00A0"), {
                    length: 45,
                  })}
                </span>
              </div>
            );

          case "highlighted":
            // don't show render highlight annotation if matches exactly with added annotation
            // this is a bit hacky patchwork should handle this for us
            if (
              annotations.some(
                (a) =>
                  (a.type === "added" && a.added === annotation.value) ||
                  (a.type === "changed" && a.after === annotation.value)
              )
            ) {
              return null;
            }

            return (
              <div
                className="text-md whitespace-nowrap overflow-ellipsis overflow-hidden"
                key={index}
              >
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
