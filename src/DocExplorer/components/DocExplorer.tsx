import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
import { Button } from "@/components/ui/button";
import {
  useCurrentAccount,
  useCurrentAccountDoc,
  useRootFolderDocWithChildren,
} from "../account";
import { DatatypeId, datatypes } from "../../datatypes";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LoadingScreen } from "./LoadingScreen";
import queryString from "query-string";

import { useSelectedDocLink } from "../hooks/useSelectedDocLink";
import { useSyncDocTitles } from "../hooks/useSyncDocTitles";
import { DocLink, DocLinkWithFolderPath, FolderDoc } from "@/folders/datatype";
import { TOOLS } from "../tools";

export const DocExplorer: React.FC = () => {
  const repo = useRepo();
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
  const selectedDocHandle = useHandle(selectedDocUrl);
  const [selectedDoc] = useDocument(selectedDocUrl);

  const selectedDocName = selectedDocLink?.name;
  const selectedDocType = selectedDocLink?.type;

  const activeTool = useMemo(() => {
    return selectedDocType ? TOOLS[selectedDocType]?.[0] : null;
  }, [selectedDocType]);

  const ToolComponent = activeTool?.component;

  const addNewDocument = useCallback(
    ({ type }: { type: DatatypeId }) => {
      if (!datatypes[type]) {
        throw new Error(`Unsupported document type: ${type}`);
      }

      const newDocHandle = repo.create();
      newDocHandle.change((doc) => datatypes[type].init(doc, repo));

      let parentFolderUrl;
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

  useSyncDocTitles({
    selectedDocLink,
    selectedDocHandle,
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
    <div>
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
          className={`flex-grow relative h-screen ${
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
              {selectedDocUrl && selectedDoc && ToolComponent && (
                <ToolComponent
                  docUrl={selectedDocUrl}
                  selectedDocLink={selectedDocLink}
                  key={selectedDocUrl}
                  selectDocLink={selectDocLink}
                />
              )}

              {!ToolComponent && (
                <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500 text-sm cursor-default">
                  No editor available for this datatype
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export type UrlHashParams = {
  docUrl: AutomergeUrl;
  docType: DatatypeId;
} | null;

const isDocType = (x: string): x is DatatypeId =>
  Object.keys(datatypes).includes(x as DatatypeId);

const parseUrl = (url: URL): DocLink | null => {
  const match = url.pathname.match(/^\/(?<name>.*-)?(?<docId>\w+)$/);

  if (!match) {
    return;
  }

  const { docId, name } = match.groups;
  const docType = url.searchParams.get("docType");
  const docUrl = `automerge:${docId}` as AutomergeUrl;

  if (!isValidAutomergeUrl(docUrl)) {
    alert(`Invalid doc id in URL: ${docUrl}`);
    return null;
  }

  if (!isDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

  // hack: allow to easily switch to patchwork by adding "&patchwork=1" to the url
  // todo: remove once patchwork is migrated to new url schema
  if (url.searchParams.get("patchwork")) {
    window.location.assign(
      `https://patchwork.tee.inkandswitch.com/#docType=${docType}&docUrl=${docUrl}`
    );
  }

  return {
    url: docUrl,
    type: docType,
    name,
  };
};
