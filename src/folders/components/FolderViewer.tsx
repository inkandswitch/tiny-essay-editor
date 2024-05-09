import { AutomergeUrl } from "@automerge/automerge-repo";
import { useDocument } from "@automerge/automerge-repo-react-hooks";

import { DocLinkWithFolderPath, FolderDoc } from "../datatype";
import { TOOLS } from "@/DocExplorer/tools";
import { datatypes } from "@/datatypes";

export const FolderViewer = ({
  docUrl,
  selectedDocLink,
  selectDocLink,
}: {
  docUrl: AutomergeUrl;
  selectedDocLink: DocLinkWithFolderPath;
  selectDocLink: (docLink: DocLinkWithFolderPath) => void;
}) => {
  const [folder] = useDocument<FolderDoc>(docUrl); // used to trigger re-rendering when the doc loads

  if (!folder) {
    return null;
  }

  return (
    <div className="p-2 h-full overflow-hidden">
      <div className="text-gray-500 text-sm mb-4 pb-2 border-b border-gray-300">
        {folder.docs.length} documents
      </div>
      <div className="flex flex-col gap-10 px-4 h-full overflow-y-auto pb-24">
        {folder.docs.map((docLink) => {
          const Tool = TOOLS[docLink.type]?.[0].component;
          const Icon = datatypes[docLink.type].icon;

          return (
            <div key={docLink.url}>
              <div className="flex gap-2 items-center font-medium mb-1">
                <Icon size={16} />
                <div>{docLink.name}</div>
                <div
                  className="text-sm text-gray-500 underline align-bottom cursor-pointer"
                  onClick={() =>
                    selectDocLink({
                      ...docLink,
                      folderPath: [...selectedDocLink.folderPath, docUrl],
                    })
                  }
                >
                  Open
                </div>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
