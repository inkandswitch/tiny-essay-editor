import { useDocument } from "@automerge/automerge-repo-react-hooks";
import React from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditorProps, Tool } from "@/os/tools";
import { PackageDoc, packageDataType } from "./datatype";

export const PackageEditor: React.FC<EditorProps<never, never>> = ({
  docUrl,
}: EditorProps<never, never>) => {
  const [moduleDoc, changeModuleDoc] = useDocument<PackageDoc>(docUrl);

  if (!moduleDoc) {
    return null;
  }

  const onChangeUrlInput = (evt) => {
    changeModuleDoc((doc) => {
      doc.source = {
        type: "url",
        url: evt.target.value,
      };
    });
  };

  const onChangeSourceCode = (evt) => {
    changeModuleDoc((doc) => {
      doc.source["index.js"] = {
        contentType: "application/javascript",
        contents: evt.target.value,
      };
    });
  };

  const handleTypeChange = (evt) => {
    const newType = evt.target.value;
    changeModuleDoc((doc) => {
      if (newType === "url") {
        doc.source = { type: "url", url: "" };
      } else if (newType === "automerge") {
        doc.source = {
          type: "automerge",
          "index.js": {
            contentType: "application/javascript",
            contents: "return {};",
          },
        };
      }
    });
  };

  return (
    <div className="p-4 w-full">
      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Package Type
        </label>
        <select
          className="block appearance-none w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:shadow-outline"
          value={moduleDoc.source.type}
          onChange={handleTypeChange}
        >
          <option value="url">URL</option>
          <option value="automerge">Automerge</option>
        </select>
      </div>

      <div className="font-mono mb-6">
        {moduleDoc.source.type === "url" && (
          <div>
            <div className="mb-2 text-gray-600 uppercase font-mono">URL</div>
            <Input
              value={moduleDoc.source.url ?? ""}
              onChange={onChangeUrlInput}
            />
          </div>
        )}
        {moduleDoc.source.type === "automerge" && (
          <div>
            <div className="mb-2 text-gray-600 uppercase font-mono">
              Source Code
            </div>
            <Textarea
              value={moduleDoc.source["index.js"].contents ?? ""}
              onChange={onChangeSourceCode}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const packageEditorTool: Tool = {
  type: "patchwork:tool",
  id: "pkg",
  name: "Package",
  supportedDataTypes: [packageDataType],
  editorComponent: PackageEditor,
};
