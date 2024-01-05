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
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { SyncIndicatorWrapper } from "./SyncIndicator";
import { AccountPicker } from "./AccountPicker";
import { saveFile } from "../utils";
import { DocLink, useCurrentRootFolderDoc } from "../account";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { save } from "@automerge/automerge";
import { parseSync } from "@effect/schema/Parser";
import { EssayV1ToHasTitleV1 } from "@/tee/schemas/transforms";

import { extension } from "mime-types";
import { Essay, EssayDoc } from "@/tee/schemas/Essay";

type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocUrl: AutomergeUrl | null;
  selectDoc: (docUrl: AutomergeUrl | null) => void;
  deleteFromAccountDocList: (docUrl: AutomergeUrl) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectedDocUrl,
  selectDoc,
  deleteFromAccountDocList,
}) => {
  const repo = useRepo();
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();
  const selectedDocName = rootFolderDoc?.docs.find(
    (doc) => doc.url === selectedDocUrl
  )?.name;
  const selectedDocHandle = useHandle<any>(selectedDocUrl);
  const [selectedDoc] = useDocument<any>(selectedDocUrl);

  // todo: do this creation in the hook itself, one time only
  const essay = new Essay(selectedDocHandle);

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
        {selectedDocName}
      </div>
      <div className="ml-3 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <SyncIndicatorWrapper docUrl={selectedDocUrl} />
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
                // todo: is this a reasonable way to get the base URL?
                // We could also get a base URL more explicitly somehow?
                const baseUrl = window.location.href.split("#")[0];
                navigator.clipboard.writeText(`${baseUrl}#${selectedDocUrl}`);
              }}
            >
              <ShareIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Copy share URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const newEssay = essay.clone();
                const newDocLink: DocLink = {
                  url: newEssay.handle.url,
                  // TODO: generalize this to other doc types besides essays
                  name: newEssay.title,
                  type: "essay",
                };

                const index = rootFolderDoc.docs.findIndex(
                  (doc) => doc.url === selectedDocUrl
                );
                changeRootFolderDoc((doc) =>
                  doc.docs.splice(index + 1, 0, newDocLink)
                );

                selectDoc(newDocLink.url);
              }}
            >
              <GitForkIcon
                className="inline-block text-gray-500 mr-2"
                size={14}
              />{" "}
              Make a copy
            </DropdownMenuItem>

            {Object.entries(essay.fileExports).map(([fileType, getFile]) => (
              <DropdownMenuItem
                key={fileType}
                onClick={() => {
                  const file = getFile();
                  const title = essay.title;
                  const safeTitle = title
                    .replace(/[^a-z0-9]/gi, "_")
                    .toLowerCase();
                  const fileExtension = extension(file.type);

                  if (!fileExtension) {
                    throw new Error(
                      `No file extension found for file type ${file.type}`
                    );
                  }

                  // TODO: generalize this logic more from markdown to others
                  saveFile(file, `${safeTitle}.${fileExtension}`, [
                    {
                      accept: {
                        "text/markdown": [`.${fileExtension}`],
                      },
                    },
                  ]);
                }}
              >
                <Download
                  size={14}
                  className="inline-block text-gray-500 mr-2"
                />{" "}
                Export as {fileType}
              </DropdownMenuItem>
            ))}

            <DropdownMenuItem onClick={() => downloadAsAutomerge()}>
              <SaveIcon size={14} className="inline-block text-gray-500 mr-2" />{" "}
              Download Automerge file
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => deleteFromAccountDocList(selectedDocUrl)}
            >
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
