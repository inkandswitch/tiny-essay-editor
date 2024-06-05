import { useDocument } from "@automerge/automerge-repo-react-hooks";
import * as A from "@automerge/automerge/next";
import React from "react";

import { EditorProps, useToolModulesForDataType } from "@/os/tools";
import { DocLink, FolderDoc } from "@/datatypes/folder";
import { selectDocLink } from "@/os/explorer/hooks/useSelectedDocLink";
import { useDataTypeModules } from "@/os/datatypes";
import { useModule } from "@/os/modules";

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
        {folderAtHeads.docs.map((docLink) => (
          <DocLinkPreview docLink={docLink} />
        ))}
      </div>
    </div>
  );
};

interface DocLinkPreviewProps {
  docLink: DocLink;
}

const DocLinkPreview: React.FC<DocLinkPreviewProps> = ({ docLink }) => {
  const dataTypeModules = useDataTypeModules();
  // we currently don't have a tool picker so we just use the first tool
  const toolModules = useToolModulesForDataType(docLink.type);
  const tool = useModule(toolModules[0]);

  const Tool = tool?.editorComponent;

  const Icon = dataTypeModules[docLink.type].metadata.icon;

  return (
    <div key={docLink.url}>
      <div className="flex gap-2 items-center font-medium mb-1">
        <Icon size={16} />
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
        {toolModules.length === 0 && <div>No editor available</div>}
        {Tool && docLink.type !== "folder" && <Tool docUrl={docLink.url} />}
        {docLink.type === "folder" && (
          <div className="bg-gray-50 justify-center items-center flex h-full">
            Click "open" to see nested folder contents
          </div>
        )}
      </div>
    </div>
  );
};
