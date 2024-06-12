import { useDocument } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";
import React from "react";

import { EditorProps, Tool } from "@/os/tools";
import { FolderDoc, folderDatatype } from "./datatype";

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
        {/*folderAtHeads.docs.map((docLink) => (      
          <FolderEntryView docLink={docLink}/>
        ))*/}
      </div>
    </div>
  );
};

/*

type FolderEntryView = {
  docLink: DocLink
}

export const FolderEntryView = ({ docLink }) => {
  const tool = useToolsForDataType(docLink.type)[0]

  if (!tool) {
    return
  }

  return (

      <div className="flex gap-2 items-center font-medium mb-1">

      {!tool ? 
       `Unknown type: ${docLink.type}`
      :   <>
      {React.createElement(tool.icon, {size: 16})}
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
        {!Tool && <div>No editor available</div>}
        {Tool && docLink.type !== "folder" && (
          <Tool docUrl={docLink.url} />
        )}
        {docLink.type === "folder" && (
          <div className="bg-gray-50 justify-center items-center flex h-full">
            Click "open" to see nested folder contents
          </div>
        )}
      </>
      
      }

        
      </div>
  );
})
};
*/

export const folderViewerTool: Tool = {
  type: "patchwork:tool",
  id: "folder",
  name: "Folder",
  editorComponent: FolderViewer,
  supportedDataTypes: [folderDatatype],
};
