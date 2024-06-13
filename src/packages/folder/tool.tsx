import { useDocument } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";
import React from "react";

import { useDataType } from "@/os/datatypes";
import { selectDocLink } from "@/os/explorer/hooks/useSelectedDocLink";
import { Icon } from "@/os/lib/icons";
import { EditorProps, Tool, useToolsForDataType } from "@/os/tools";
import { DocLink, FolderDoc } from "./datatype";

export const FolderViewer: React.FC<EditorProps<never, never>> = ({
  docUrl,
  docHeads,
}: EditorProps<never, never>) => {
  const [folder] = useDocument<FolderDoc>(docUrl); // used to trigger re-rendering when the doc loads

  const folderAtHeads = docHeads ? A.view(folder, docHeads) : folder;

  if (!folder) {
    return null;
  }

  return (
    <div className="p-2 h-full overflow-hidden">
      <div className="text-gray-500 text-sm mb-4 pb-2 border-b border-gray-300">
        {folderAtHeads.docs.length} documents
      </div>
      <div className="flex flex-col gap-10 px-4 h-full overflow-y-auto pb-24">
        {folderAtHeads.docs.map((docLink, index) => (
          <FolderEntryView docLink={docLink} key={index} />
        ))}
      </div>
    </div>
  );
};

type FolderEntryView = {
  docLink: DocLink;
};

export const FolderEntryView = ({ docLink }) => {
  const dataType = useDataType(docLink.type);
  const tool = useToolsForDataType(docLink.type)[0];

  const icon = tool?.icon ?? dataType?.icon;

  return (
    <div>
      {!tool ? (
        <div className="flex gap-2 items-center font-medium mb-1">
          Unknown type: {docLink.type}
        </div>
      ) : (
        <>
          <div className="flex gap-2 items-center font-medium mb-1">
            <Icon type={icon} size={16} />
            <div>{docLink.name}</div>
            <button
              className="text-sm text-gray-500 underline align-bottom cursor-pointer"
              onClick={() => {
                selectDocLink(docLink);
              }}
            >
              Open
            </button>
          </div>
          <div className="h-72 border border-gray-300">
            {!tool && <div>No editor available</div>}
            {tool &&
              docLink.type !== "folder" &&
              React.createElement(tool.editorComponent, {
                docUrl: docLink.url,
              })}
            {docLink.type === "folder" && (
              <div className="bg-gray-50 justify-center items-center flex h-full">
                Click "open" to see nested folder contents
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const folderViewerTool: Tool = {
  type: "patchwork:tool",
  id: "folder",
  name: "Folder",
  editorComponent: FolderViewer,
  supportedDataTypes: ["folder"],
};
