import { Button } from "@/components/ui/button";
import { useDataType, useDataTypes } from "@/os/datatypes";
import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  useCurrentAccount,
  useCurrentAccountDoc,
  useRootFolderDocWithChildren,
} from "../account";

import { Toaster } from "@/components/ui/sonner";
import { LoadingScreen } from "./LoadingScreen";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

import { VersionControlEditor } from "@/os/versionControl/components/VersionControlEditor";
import { Branch, HasVersionControlMetadata } from "@/os/versionControl/schema";

import { useTool, useTools, useToolsForDataType } from "@/os/tools";
import { DocLinkWithFolderPath, FolderDoc } from "@/packages/folder";
import { useSelectedDocLink } from "../hooks/useSelectedDocLink";
import { useSyncDocTitle } from "../hooks/useSyncDocTitle";
import { ErrorFallback } from "./ErrorFallback";

export const Explorer: React.FC = () => {
  const repo = useRepo();
  const dataTypes = useDataTypes();
  const currentAccount = useCurrentAccount();
  const [accountDoc] = useCurrentAccountDoc();

  const rootFolderData = useRootFolderDocWithChildren();
  const { doc: rootFolderDoc, rootFolderUrl } = rootFolderData;

  const [showSidebar, setShowSidebar] = useState(true);

  const { selectedDocLink, selectDocLink } = useSelectedDocLink({
    folderDocWithMetadata: rootFolderData,
    repo,
  });

  const selectedDocUrl = selectedDocLink?.url;
  const selectedDocHandle =
    useHandle<HasVersionControlMetadata<unknown, unknown>>(selectedDocUrl);
  const [selectedDoc] =
    useDocument<HasVersionControlMetadata<unknown, unknown>>(selectedDocUrl);

  const selectedDocName = selectedDocLink?.name;
  const selectedDataTypeId = selectedDocLink?.type;
  const selectedBranchUrl = selectedDocLink?.branchUrl;

  const selectedBranch = useMemo<Branch>(() => {
    if (!selectedBranchUrl || !selectedDoc) {
      return;
    }

    return selectedDoc.branchMetadata.branches.find(
      (b) => b.url === selectedBranchUrl
    );
  }, [selectedBranchUrl, selectedDoc]);

  const selectedDataType = useDataType(selectedDataTypeId);
  const tools = useToolsForDataType(selectedDataType);
  const [selectedToolId, setSelectedToolId] = useState<string>();
  const toolModules = useToolsForDataType(selectedDataType);
  const selectedTool = useTool(selectedToolId);

  console.log({ selectedDataType, tools });

  const currentTool =
    // make sure the current tool is reset to the fallback tool
    // if the selected datatype changes and the selected tool is not compatible
    selectedTool &&
    (selectedTool.supportedDataTypes === "*" ||
      selectedTool.supportedDataTypes.some(
        (supportedDataType) => supportedDataType === selectedDataType
      ))
      ? selectedTool
      : toolModules[0];

  const addNewDocument = useCallback(
    async ({ type }: { type: string }) => {
      const dataType = dataTypes.find(({ id }) => id === type);

      if (!dataType) {
        throw new Error(`Unsupported document type: ${type}`);
      }

      const newDocHandle =
        repo.create<HasVersionControlMetadata<unknown, unknown>>();
      newDocHandle.change((doc) => dataType.init(doc, repo));

      let parentFolderUrl: AutomergeUrl;
      let folderPath: AutomergeUrl[];

      if (!selectedDocLink) {
        parentFolderUrl = rootFolderUrl;
        folderPath = [rootFolderUrl];
      } else if (selectedDocLink.type === "folder") {
        // If a folder is currently selected, add the new document to that folder
        parentFolderUrl = selectedDocLink.url;
        folderPath = [...selectedDocLink.folderPath, selectedDocLink.url];
      } else {
        // Otherwise, add the new document to the parent folder of the selected doc
        parentFolderUrl =
          selectedDocLink?.folderPath[selectedDocLink.folderPath.length - 1];
        folderPath = selectedDocLink.folderPath;
      }

      const newDocLink = {
        url: newDocHandle.url,
        type,
        name: "Untitled document",
      };

      repo
        .find<FolderDoc>(parentFolderUrl)
        .change((doc) => doc.docs.unshift(newDocLink));

      selectDocLink({
        ...newDocLink,
        folderPath,
      });
    },
    [repo, selectedDocLink, selectDocLink]
  );

  useSyncDocTitle({
    selectedDocLink,
    selectedDoc,
    selectDocLink,
    repo,
  });

  // update tab title to be the selected doc
  useEffect(() => {
    document.title = selectedDocName ?? "Essay Editor"; // TODO: generalize beyond TEE
  }, [selectedDocName]);

  // keyboard shortcuts
  useEffect(() => {
    const keydownHandler = (event: KeyboardEvent) => {
      // toggle the sidebar open/closed when the user types cmd-backslash
      if (event.key === "\\" && event.metaKey) {
        setShowSidebar((prev) => !prev);
      }

      // if there's no document selected and the user hits enter, make a new document
      if (!selectedDocUrl && event.key === "Enter") {
        addNewDocument({ type: "essay" });
      }
    };

    window.addEventListener("keydown", keydownHandler);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("keydown", keydownHandler);
    };
  }, [addNewDocument, selectedDocUrl]);

  const removeDocLink = async (link: DocLinkWithFolderPath) => {
    const folderHandle = repo.find<FolderDoc>(
      link.folderPath[link.folderPath.length - 1]
    );
    await folderHandle.whenReady();
    const itemIndex = folderHandle
      .docSync()
      .docs.findIndex((item) => item.url === link.url);
    if (itemIndex >= 0) {
      if (itemIndex < folderHandle.docSync().docs.length - 1) {
        selectDocLink({
          ...folderHandle.docSync().docs[itemIndex + 1],
          folderPath: link.folderPath,
        });
      } else if (itemIndex > 1) {
        selectDocLink({
          ...folderHandle.docSync().docs[itemIndex - 1],
          folderPath: link.folderPath,
        });
      } else {
        selectDocLink(null);
      }

      // Wait for the URL to update before we delete the doc link;
      // otherwise we end up re-adding it via the existing URL
      setTimeout(() => {
        folderHandle.change((doc) => {
          doc.docs.splice(itemIndex, 1);
        });
      }, 0);
    }
  };

  if (!accountDoc || !rootFolderDoc) {
    return (
      <LoadingScreen
        docUrl={currentAccount?.handle?.url}
        handle={currentAccount?.handle}
      />
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="flex flex-row w-screen h-screen overflow-hidden">
        <div
          className={`${
            showSidebar ? "w-64" : "w-0 translate-x-[-100%]"
          } flex-shrink-0 bg-gray-100 border-r border-gray-400 transition-all duration-100 overflow-hidden  `}
        >
          <Sidebar
            rootFolderDoc={rootFolderData}
            selectedDocLink={selectedDocLink}
            selectDocLink={selectDocLink}
            hideSidebar={() => setShowSidebar(false)}
            addNewDocument={addNewDocument}
          />
        </div>
        <div
          className={`flex-grow relative h-screen overflow-hidden ${
            !selectedDocUrl ? "bg-gray-200" : ""
          }`}
        >
          <div className="flex flex-col h-screen">
            <Topbar
              showSidebar={showSidebar}
              setShowSidebar={setShowSidebar}
              selectDocLink={selectDocLink}
              selectedDocLink={selectedDocLink}
              selectedDoc={selectedDoc}
              selectedDocHandle={selectedDocHandle}
              removeDocLink={removeDocLink}
              addNewDocument={addNewDocument}
              setToolId={setSelectedToolId}
              tool={currentTool}
              tools={tools}
            />
            <div className="flex-grow overflow-hidden z-0">
              {!selectedDocUrl && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div>
                    <p className="text-center cursor-default select-none mb-4">
                      No document selected
                    </p>
                    <Button
                      onClick={() => addNewDocument({ type: "essay" })} // Default type for new document
                      variant="outline"
                    >
                      Create new document
                      <span className="ml-2">(&#9166;)</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* NOTE: we set the URL as the component key, to force re-mount on URL change.
                If we want more continuity we could not do this. */}
              {selectedDocUrl && selectedDoc && currentTool && (
                <VersionControlEditor
                  datatypeId={selectedDocLink?.type}
                  docUrl={selectedDocUrl}
                  key={selectedDocUrl}
                  tool={currentTool}
                  selectedBranch={selectedBranch}
                  setSelectedBranch={(branch) => {
                    selectDocLink({
                      ...selectedDocLink,
                      branchUrl: branch?.url,
                      branchName: branch?.name,
                    });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <Toaster />
    </ErrorBoundary>
  );
};
