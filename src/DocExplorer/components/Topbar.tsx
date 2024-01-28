import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useCallback } from "react";
import {
  Bot,
  Download,
  EditIcon,
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
import { asMarkdownFile, markCopy } from "../../tee/datatype";
import { SyncIndicatorWrapper } from "./SyncIndicator";
import { AccountPicker } from "./AccountPicker";
import { MarkdownDoc } from "@/tee/schema";
import { getTitle } from "@/tee/datatype";
import { saveFile, setUrlHashForDoc } from "../utils";
import { DocLink, useCurrentRootFolderDoc } from "../account";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getHeads, save } from "@automerge/automerge";
import { toast } from "sonner";
import { runBot } from "@/bots/llm";
import { DocType } from "../docTypes";
type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocUrl: AutomergeUrl | null;
  selectDoc: (docUrl: AutomergeUrl | null) => void;
  deleteFromAccountDocList: (docUrl: AutomergeUrl) => void;
  addNewDocument: (doc: { type: DocType }) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectedDocUrl,
  selectDoc,
  deleteFromAccountDocList,
  addNewDocument,
}) => {
  const repo = useRepo();
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();
  const selectedDocLink = rootFolderDoc?.docs.find(
    (doc) => doc.url === selectedDocUrl
  );
  const selectedDocName = selectedDocLink?.name;
  const selectedDocHandle = useHandle<MarkdownDoc>(selectedDocUrl);

  // GL 12/13: here we assume this is a TEE Markdown doc, but in future should be more generic.
  const [selectedDoc] = useDocument<MarkdownDoc>(selectedDocUrl);

  const exportAsMarkdown = useCallback(() => {
    const file = asMarkdownFile(selectedDoc);
    saveFile(file, "index.md", [
      {
        accept: {
          "text/markdown": [".md"],
        },
      },
    ]);
  }, [selectedDoc]);

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

  const botDocLinks = rootFolderDoc?.docs.filter((doc) => doc.type === "bot");

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
      <div className="ml-1 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <SyncIndicatorWrapper docUrl={selectedDocUrl} />
        )}
      </div>

      {/* todo: the logic for running bots and when to show the menu should
       probably live inside the bots directory --
       how do datatypes contribute things to the global topbar? */}
      {selectedDocLink?.type === "essay" && (
        <div className="ml-auto mr-4">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Bot
                size={18}
                className="mt-1 mr-21 text-gray-500 hover:text-gray-800"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-4">
              {botDocLinks.length === 0 && (
                <div>
                  <div className="text-gray-500 max-w-48 p-2">
                    No bots in sidebar. <br />
                    Click "New Bot" or get a share link from someone.
                  </div>
                </div>
              )}
              {botDocLinks.map((botDocLink) => (
                <DropdownMenuItem
                  key={botDocLink.url}
                  onClick={async () => {
                    const resultPromise = runBot({
                      botDocUrl: botDocLink.url,
                      targetDocHandle: selectedDocHandle,
                      repo,
                    });
                    toast.promise(resultPromise, {
                      loading: `Running ${botDocLink.name}...`,
                      success: `${botDocLink.name} ran successfully`,
                      error: `${botDocLink.name} failed, see console`,
                    });
                  }}
                >
                  Run {botDocLink.name}
                  <EditIcon
                    size={14}
                    className="inline-block ml-2 cursor-pointer"
                    onClick={(e) => {
                      selectDoc(botDocLink.url);
                      e.stopPropagation();
                    }}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className={`mr-4 ${selectedDocLink?.type !== "essay" && "ml-auto"}`}>
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
              onClick={() => {
                const newHandle = repo.clone<MarkdownDoc>(selectedDocHandle);
                newHandle.change((doc) => {
                  markCopy(doc);
                  doc.copyMetadata.source = {
                    url: selectedDocUrl,
                    copyHeads: getHeads(selectedDocHandle.docSync()),
                  };
                });

                const newDocLink: DocLink = {
                  url: newHandle.url,
                  name: getTitle(newHandle.docSync().content),
                  type: selectedDocLink.type,
                };

                const index = rootFolderDoc.docs.findIndex(
                  (doc) => doc.url === selectedDocUrl
                );
                changeRootFolderDoc((doc) =>
                  doc.docs.splice(index + 1, 0, newDocLink)
                );

                setUrlHashForDoc({
                  docUrl: newDocLink.url,
                  docType: newDocLink.type,
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
