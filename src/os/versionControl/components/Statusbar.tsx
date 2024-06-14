import { DataType } from "@/os/datatypes";
import { EditorProps, useToolsForDataType } from "@/os/tools";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import React, { useMemo } from "react";
import { PackageDoc } from "@/packages/pkg/datatype";
import { useDocument } from "@automerge/automerge-repo-react-hooks";

type StatusBarProps = EditorProps<unknown, unknown> & {
  dataType: DataType<unknown, unknown, unknown>;
  addNewDocument: (doc: { type: string; change?: (doc: any) => void }) => void;
};

const getEmptyPackageSource = (dataType: string, doc: any) => {
  return `
import React from "react";
import {useDocument} from "@automerge/automerge-repo-react-hooks";

/*
 An example for doc:

*/

export const tool = {
  type: "patchwork:tool",
  id: "??", // todo: come up with an id
  name: "??", // todo: come up with a short name
  supportedDataTypes: ["${dataType}"],
  statusBarComponent: ({ docUrl }) => {
    const [doc] = useDocument(docUrl);

    // todo: implement

    return null
  },
};


`;
};

export const StatusBar = (props: StatusBarProps) => {
  const { dataType, addNewDocument, docUrl } = props;

  const [doc] = useDocument(docUrl);

  const tools = useToolsForDataType(dataType);
  const toolsWithStatusBarComponent = useMemo(
    () => tools.filter((tool) => tool.statusBarComponent),

    [tools]
  );

  console.log({ tools });

  return (
    <div
      className="bg-gray-100 p-2 flex items-center border-t border-gray-200 gap-3"
      style={{ height: "48px" }}
    >
      {toolsWithStatusBarComponent.map((tool) => (
        <div
          className={`bg-white border border-gray-200 rounded-md px-2 py-1 relative ${
            tool.sourceDocUrl ? "border-dashed" : ""
          }`}
        >
          {React.createElement(tool.statusBarComponent, props)}
          {tool.sourceDocUrl ? (
            <div
              style={{ transform: " translate(-10px, -60px) rotate(-5deg)" }}
              className="absolute whitespace-nowrap bg-yellow-100 border border-yellow-200 px-1 "
            >
              {(tool.sourceDocUrl as any).name}
            </div>
          ) : (
            ""
          )}
        </div>
      ))}

      {false && (
        <Button
          variant="ghost"
          onClick={() =>
            addNewDocument({
              type: "pkg",
              change: (doc) => {
                (doc as PackageDoc).source = {
                  type: "automerge",
                  "index.js": {
                    contentType: "application/javascript",
                    contents: getEmptyPackageSource(dataType.id, doc),
                  },
                };
              },
            })
          }
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
};
