import { DocLink, DocLinkWithFolderPath, FolderDoc } from "@/packages/folder";
import { Doc, DocHandle, isValidAutomergeUrl } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import {
  BotIcon,
  Download,
  EditIcon,
  GitForkIcon,
  Menu,
  MoreHorizontal,
  ShareIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useRef } from "react";
import { toast } from "sonner";
import { saveFile } from "../utils";
import { AccountPicker } from "./AccountPicker";
import { SyncIndicator } from "./SyncIndicator";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { genericExportMethods } from "@/os/fileExports";
import { Tool } from "@/os/tools";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { runBot } from "@/packages/bot";
import { MarkdownDoc } from "@/packages/essay";
import { getHeads } from "@automerge/automerge";
import { useDataType } from "../../datatypes";
import { useDatatypeSettings, useRootFolderDocWithChildren } from "../account";
import { getUrlSafeName } from "../hooks/useSelectedDocLink";

type TopbarProps = {
  showSidebar: boolean;
  setShowSidebar: (showSidebar: boolean) => void;
  selectedDocLink: DocLinkWithFolderPath | undefined;
  selectDocLink: (docLink: DocLinkWithFolderPath | null) => void;
  selectedDoc: Doc<HasVersionControlMetadata<unknown, unknown>> | undefined;
  selectedDocHandle:
    | DocHandle<HasVersionControlMetadata<unknown, unknown>>
    | undefined;
  addNewDocument: (doc: { type: string }) => void;
  removeDocLink: (link: DocLinkWithFolderPath) => void;
  tools: Tool[];
  tool: Tool;
  setToolId: (id: string) => void;
};

export const Topbar: React.FC<TopbarProps> = ({
  showSidebar,
  setShowSidebar,
  selectDocLink,
  selectedDocLink,
  selectedDoc,
  selectedDocHandle,
  tools,
  tool,
  setToolId: setToolModuleId,
  removeDocLink,
}) => {
  const repo = useRepo();

  const { flatDocLinks } = useRootFolderDocWithChildren();

  const datatypeSettings = useDatatypeSettings();
  const isBotDatatypeEnabled = datatypeSettings?.enabledDatatypeIds.bot;

  const selectedDocUrl = selectedDocLink?.url;
  const selectedDocName = selectedDocLink?.name;
  const selectedDataTypeId = selectedDocLink?.type;
  const selectedDataTypeRef = useRef<string>();
  selectedDataTypeRef.current = selectedDataTypeId;

  const selectedDataType = useDataType(selectedDataTypeId);

  const botDocLinks = flatDocLinks?.filter((doc) => doc.type === "bot") ?? [];

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
        {selectedDataType &&
          React.createElement(selectedDataType.icon, {
            className: "inline mr-1",
            size: 14,
          })}
        {selectedDocName}
      </div>
      <div className="ml-1 mt-[-2px]">
        {isValidAutomergeUrl(selectedDocUrl) && (
          <SyncIndicator docUrl={selectedDocUrl} />
        )}
      </div>

      {tools.length > 1 && selectedDocLink && (
        <Tabs
          value={tool?.id}
          className="ml-auto"
          onValueChange={setToolModuleId}
        >
          <TabsList>
            {tools.map((tool) => (
              <TabsTrigger value={tool.id} className="px-2 py-1" key={tool.id}>
                {tool.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className={`mr-4 ${tools.length <= 1 ? "ml-auto" : "ml-4"}`}>
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
                toast.success("Copied to clipboard");
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
                const newHandle =
                  repo.clone<HasVersionControlMetadata<unknown, unknown>>(
                    selectedDocHandle
                  );
                newHandle.change((doc: any) => {
                  selectedDataType.markCopy(doc);
                  doc.branchMetadata.source = {
                    url: selectedDocUrl,
                    branchHeads: getHeads(selectedDocHandle.docSync()),
                  };
                });

                const newDocLink: DocLink = {
                  url: newHandle.url,
                  name: await selectedDataType.getTitle(
                    newHandle.docSync(),
                    repo
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
            <DropdownMenuSeparator />
            {(selectedDataType?.fileExportMethods ?? [])
              .concat(genericExportMethods)
              .map((method, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={async () => {
                    const blob = await method.export(selectedDoc, repo);
                    const filename = `${getUrlSafeName(selectedDocLink.name)}.${
                      method.extension
                    }`;
                    saveFile(blob, filename, [
                      {
                        accept: {
                          [method.contentType]: [`.${method.extension}`],
                        },
                      },
                    ]);
                  }}
                >
                  <Download
                    size={14}
                    className="inline-block text-gray-500 mr-2"
                  />{" "}
                  Export as {method.name}
                </DropdownMenuItem>
              ))}

            {selectedDocLink?.type === "essay" && isBotDatatypeEnabled && (
              <>
                {/* todo: the logic for running bots and when to show the menu should
                probably live inside the bots directory --
                how do datatypes contribute things to the global topbar? */}
                <DropdownMenuSeparator />

                {botDocLinks.map((botDocLink) => (
                  <DropdownMenuItem
                    className="flex justify-between"
                    key={botDocLink.url}
                    onClick={async () => {
                      const resultPromise = runBot({
                        botDocUrl: botDocLink.url,
                        targetDocHandle:
                          selectedDocHandle as DocHandle<MarkdownDoc>,
                        repo,
                      });
                      toast.promise(resultPromise, {
                        loading: `Running ${botDocLink.name}...`,
                        success: (result) => (
                          <div className="flex gap-1">
                            <div className="flex items-center gap-2">
                              <div className="max-w-48">
                                {botDocLink.name} ran successfully.
                              </div>
                              <Button
                                onClick={() => {
                                  selectDocLink({
                                    ...selectedDocLink,
                                    branchUrl: result,
                                  });
                                }}
                                className="px-4 h-6"
                              >
                                View branch
                              </Button>
                            </div>
                          </div>
                        ),
                        error: `${botDocLink.name} failed, see console`,
                      });
                    }}
                  >
                    <div className="flex items-center">
                      <BotIcon
                        className="inline-block text-gray-500 mr-2"
                        size={14}
                      />{" "}
                      Run {botDocLink.name}
                    </div>
                    <EditIcon
                      size={14}
                      className="inline-block ml-2 cursor-pointer"
                      onClick={(e) => {
                        selectDocLink({
                          ...botDocLink,
                          type: "essay",
                        });
                        e.stopPropagation();
                      }}
                    />
                  </DropdownMenuItem>
                ))}
              </>
            )}

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
