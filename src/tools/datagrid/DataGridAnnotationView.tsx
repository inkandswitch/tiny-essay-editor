import { DataGridDoc, DataGridDocAnchor } from "@/datatypes/datagrid";
import { AnnotationsViewProps } from "@/os/tools";
import React from "react";

export const DataGridAnnotationView = ({
  annotations,
}: AnnotationsViewProps<DataGridDoc, DataGridDocAnchor, string>) => {
  return (
    <div>
      {annotations.map((annotation) => (
        <div
          className={`border border-gray-200 p-1 mx-auto ${
            annotation.type === "highlighted" ? "bg-yellow-50" : ""
          }`}
          style={{
            fontSize: 13,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
          }}
        >
          {annotation.value}
        </div>
      ))}
    </div>
  );
};
