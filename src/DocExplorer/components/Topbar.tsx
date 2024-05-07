import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useCallback } from "react";
import {
  Download,
  GitForkIcon,
  Menu,
  MoreHorizontal,
  SaveIcon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { SyncIndicator } from "./SyncIndicator";
import { AccountPicker } from "./AccountPicker";
import { saveFile } from "../utils";
import { DocLink, DocLinkWithFolderPath, FolderDoc } from "@/folders/datatype";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Doc, save } from "@automerge/automerge";
import { DatatypeId, datatypes } from "../../datatypes";
import { asMarkdownFile } from "@/tee/datatype";
import { MarkdownDoc } from "@/tee/schema";
import { DocHandle } from "@automerge/automerge-repo";

type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocLink: DocLinkWithFolderPath | undefined;
  selectDocLink: (docLink: DocLinkWithFolderPath | null) => void;
  selectedDoc: Doc<unknown> | undefined;
  selectedDocHandle: DocHandle<unknown> | undefined;
  addNewDocument: (doc: { type: DatatypeId }) => void;
  removeDocLink: (link: DocLinkWithFolderPath) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectDocLink,
  selectedDocLink,
  selectedDoc,
  selectedDocHandle,
  removeDocLink,
}) => {
  const repo = useRepo();

  const selectedDocUrl = selectedDocLink?.url;
  const selectedDocName = selectedDocLink?.name;
  const selectedDocType = selectedDocLink?.type;

  const selectedDatatypeMetadata = datatypes[selectedDocType];

  // GL 12/13: here we assume this is a TEE Markdown doc, but in future should be more generic.

  const exportAsMarkdown = useCallback(() => {
    if (selectedDocType !== "essay") {
      throw new Error("Not supported");
    }
    const file = asMarkdownFile(selectedDoc as MarkdownDoc);
    saveFile(file, "index.md", [
      {
        accept: {
          "text/markdown": [".md"],
        },
      },
    ]);
  }, [selectedDoc, selectedDocType]);

  const downloadAsAutomerge = useCallback(() => {
    const file = new Blob([save(selectedDoc)], {
      type: "application/octet-stream",
    });
    saveFile(file, `${selectedDocUrl}.automerge`, [
      {
        accept: {
          "application/octet-stream": [".automerge"],
        },
      },
    ]);
  }, [selectedDocUrl, selectedDoc]);

  return (
    <div className="h-10 bg-gray-100 flex items-center flex-shrink-0 border-b border-gray-300">
      {!showSidebar && (
        <div
          className="ml-1 p-1 text-gray-500 bg-gray-100 hover:bg-gray-300 hover:text-gray-500 cursor-pointer  transition-all rounded-sm"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          <Menu size={18} />
        </div>
      )}
      <div className="ml-3 text-sm text-gray-700 font-bold">
        {selectedDatatypeMetadata && (
          <selectedDatatypeMetadata.icon className="inline mr-1" size={14} />
        )}
        {selectedDocName}
      </div>
      <div className="ml-3 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <SyncIndicator docUrl={selectedDocUrl} />
        )}
      </div>
      <div className="ml-auto mr-4">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <MoreHorizontal
              size={18}
              className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mr-4">
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
            >
              <ShareIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Copy share URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const newHandle = repo.clone(selectedDocHandle);
                newHandle.change((doc: any) => {
                  datatypes[selectedDocType].markCopy(doc);
                });
                const newDocLink: DocLink = {
                  url: newHandle.url,
                  name: datatypes[selectedDocType].getTitle(
                    newHandle.docSync()
                  ),
                  type: selectedDocLink.type,
                };

                const folderHandle = repo.find<FolderDoc>(
                  selectedDocLink.folderPath[
                    selectedDocLink.folderPath.length - 1
                  ]
                );
                await folderHandle.whenReady();

                const index = folderHandle
                  .docSync()
                  .docs.findIndex((doc) => doc.url === selectedDocUrl);
                folderHandle.change((doc) =>
                  doc.docs.splice(index + 1, 0, newDocLink)
                );

                // TODO: we used to have a setTimeout here, see if we need to bring it back.
                selectDocLink({
                  ...newDocLink,
                  folderPath: selectedDocLink.folderPath,
                });
              }}
            >
              <GitForkIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Make a copy
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => exportAsMarkdown()}>
              <Download size={14} className="inline-block text-gray-500 mr-2" />{" "}
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadAsAutomerge()}>
              <SaveIcon size={14} className="inline-block text-gray-500 mr-2" />{" "}
              Download Automerge file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => removeDocLink(selectedDocLink)}>
              <Trash2Icon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Remove from My Documents
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mr-4 mt-1">
        <AccountPicker />
      </div>
    </div>
  );
};
