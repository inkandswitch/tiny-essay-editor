import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useDocument,
  useHandle,
  useRepo,
} from "@automerge/automerge-repo-react-hooks";
// import { init } from "../../tee/datatype";
import { Button } from "@/components/ui/button";
import {
  DocLink,
  FolderDoc,
  useCurrentAccount,
  useCurrentAccountDoc,
  useCurrentRootFolderDoc,
} from "../account";
import { DocType, docTypes } from "../doctypes";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { LoadingScreen } from "./LoadingScreen";
import { Toaster } from "@/components/ui/sonner";

import queryString from "query-string";
import { PatchworkDocEditor } from "@/patchwork/components/PatchworkDocEditor";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { useStaticCallback } from "@/tee/utils";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";
import { useCurrentUrl, replaceUrl } from "../navigation";

export type Tool = {
  id: string;
  name: string;
  component: React.FC;
};

const TOOLS = {
  essay: [
    {
      id: "essay",
      name: "Editor",
      component: TinyEssayEditor,
    },
  ],
  tldraw: [
    {
      id: "tldraw",
      name: "Drawing",
      component: TLDraw,
    },
  ],
};

export const DocExplorer: React.FC = () => {
  const repo = useRepo();
  const currentAccount = useCurrentAccount();
  const [accountDoc, changeAccountDoc] = useCurrentAccountDoc();
  const [rootFolderDoc, _changeRootFolderDoc] = useCurrentRootFolderDoc();

  // we need to wrap _changeRootFolderDoc with useStaticCallback, otherwise changeRootFolderDoc will be a differen instance on each render
  // which triggers an infinite rerender loop because we pass it to useSelectedDoc as a dependency
  // probably we should push this down into automerge-repo that useDocument returns the same callback if the url hasn't changed
  const changeRootFolderDoc = useStaticCallback(_changeRootFolderDoc);

  const [showSidebar, setShowSidebar] = useState(false);
  // todo: allow to select branches
  const [selectedDocLink, setSelectedDocLink] = useSelectedDocLink({
    rootFolderDoc,
    changeRootFolderDoc,
  });

  const [selectedDoc] = useDocument<HasPatchworkMetadata<unknown, unknown>>(
    selectedDocLink?.url
  );

  const selectedDocName = selectedDocLink?.name;
  const selectedDocUrl = selectedDocLink?.url;
  const selectedDocType = selectedDocLink?.type;

  const availableTools = useMemo(() => {
    return selectedDocType ? TOOLS[selectedDocType] : [];
  }, [selectedDocType]);

  const [activeTool, setActiveTool] = useState(availableTools[0] ?? null);
  useEffect(() => {
    setActiveTool(availableTools[0]);
  }, [availableTools]);

  const ToolComponent = activeTool?.component;

  const addNewDocument = useCallback(
    ({ type }: { type: DocType }) => {
      if (!docTypes[type]) {
        throw new Error(`Unsupported document type: ${type}`);
      }

      const newDocHandle =
        repo.create<HasPatchworkMetadata<unknown, unknown>>();
      newDocHandle.change((doc) => docTypes[type].init(doc, repo));

      if (!rootFolderDoc) {
        return;
      }

      const newDocLink = {
        type: type,
        name: "Untitled document",
        url: newDocHandle.url,
      };

      changeRootFolderDoc((doc) => doc.docs.unshift(newDocLink));

      // By updating the URL to the new doc, we'll trigger a navigation
      setSelectedDocLink(newDocLink);
    },
    [changeRootFolderDoc, repo, rootFolderDoc]
  );

  // sync doc names up from TEE docs to the sidebar list.
  useEffect(() => {
    (async () => {
      if (selectedDoc === undefined || selectedDocLink === undefined) {
        return;
      }
      const title = await docTypes[selectedDocLink.type].getTitle(
        selectedDoc,
        repo
      );

      changeRootFolderDoc((doc) => {
        const existingDocLink = doc.docs.find(
          (link) => link.url === selectedDocUrl
        );
        if (existingDocLink && existingDocLink.name !== title) {
          existingDocLink.name = title;
        }
      });
    })();
  }, [
    selectedDoc,
    changeAccountDoc,
    rootFolderDoc,
    changeRootFolderDoc,
    selectedDocLink,
    repo,
  ]);

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

  const deleteFromRootFolder = (id: string) => {
    const itemIndex = rootFolderDoc?.docs.findIndex((item) => item.url === id);
    if (itemIndex >= 0) {
      if (itemIndex < rootFolderDoc?.docs.length - 1) {
        setSelectedDocLink(rootFolderDoc?.docs[itemIndex + 1]);
      } else if (itemIndex > 1) {
        setSelectedDocLink(rootFolderDoc?.docs[itemIndex - 1]);
      } else {
        setSelectedDocLink(null);
      }
      changeRootFolderDoc((doc) => {
        doc.docs.splice(itemIndex, 1);
      });
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
            selectedDocUrl={selectedDocUrl}
            selectDocLink={setSelectedDocLink}
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
              selectedDocLink={selectedDocLink}
              selectDocLink={setSelectedDocLink}
              deleteFromAccountDocList={deleteFromRootFolder}
              setSelectedBranch={() => {} /*TODO: selectBranch*/}
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
              {selectedDocUrl && selectedDoc && (
                <PatchworkDocEditor
                  docType={selectedDocLink?.type}
                  docUrl={selectedDocUrl}
                  key={selectedDocUrl}
                  selectedBranch={{ type: "main" } /*TODO: selectedBranch*/}
                  setSelectedBranch={() => {} /*TODO: selectBranch */}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
};

const isValidDocType = (x: string): x is DocType =>
  Object.keys(docTypes).includes(x as DocType);

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

  if (!isValidDocType(docType)) {
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

const parseLegacyUrl = (url: URL): DocLink => {
  // This is a backwards compatibility shim for old URLs where we
  // only had one parameter, the Automerge URL.
  // We just assume it's a TEE essay in that case.
  const possibleAutomergeUrl = url.pathname.slice(1);
  if (isValidAutomergeUrl(possibleAutomergeUrl)) {
    return {
      url: possibleAutomergeUrl,
      name: "",
      type: "essay",
    };
  }

  // Now on to the main logic where we look for a url and type both.
  const { docUrl, docType } = queryString.parse(url.pathname.slice(1));

  if (typeof docUrl !== "string" || typeof docType !== "string") {
    return null;
  }

  if (typeof docUrl === "string" && !isValidAutomergeUrl(docUrl)) {
    alert(`Invalid Automerge URL in URL: ${docUrl}`);
    return null;
  }

  if (typeof docType === "string" && !isValidDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

  // NOTE: the URL may contain a branchUrl, which we need to turn into a SelectedBranch value
  // If it's missing, the selected branch is main.
  /* const selectedBranch: SelectedBranch =
    branchUrl && typeof branchUrl === "string" && isValidAutomergeUrl(branchUrl)
      ? { type: "branch", url: branchUrl }
      : { type: "main" }; */

  return {
    url: docUrl,
    name: "",
    type: docType,
  };
};

// Drive the currently selected doc using the URL
// (We encapsulate the selection state in a hook so that the only
// API for changing the selection is properly thru the URL)
const useSelectedDocLink = ({
  rootFolderDoc,
  changeRootFolderDoc,
}: {
  rootFolderDoc: FolderDoc;
  changeRootFolderDoc: (fn: (doc: FolderDoc) => void) => void;
}): [DocLink, (docLink: DocLink) => void] => {
  const currentUrl = useCurrentUrl();

  const setSelectedDocLink = (docLink: DocLink) => {
    if (
      selectedDocLink &&
      selectedDocLink.url === docLink.url &&
      selectedDocLink.type == docLink.type
    ) {
      return;
    }

    location.hash = docLinkToUrl(docLink);
  };

  const urlParams = useMemo(() => parseUrl(currentUrl), [currentUrl]);

  const selectedDocLink = useMemo<DocLink | null>(() => {
    if (!rootFolderDoc || !urlParams) {
      return;
    }

    const { type, url } = urlParams;

    return {
      type,
      url,
      name:
        rootFolderDoc.docs.find((docLink) => docLink.url === url)?.name ??
        "Unknown document",
    };
  }, [urlParams?.type, urlParams?.url, rootFolderDoc]);

  // We redirect old urls to the new format
  useEffect(() => {
    if (!urlParams) {
      const docLink = parseLegacyUrl(currentUrl);
      if (docLink) {
        setSelectedDocLink(docLink);
      }
    }
  }, [currentUrl.hash]);

  // Whenever the name of the selected document changes,
  // we update the name in the url by replacing the url
  useEffect(() => {
    if (!selectedDocLink) {
      return;
    }

    const url = docLinkToUrl(selectedDocLink);
    replaceUrl(url);
  }, [selectedDocLink?.name]);

  // We check if the current file is already in the root folder
  // If not we add it to the top of the root folder
  useEffect(() => {
    if (!rootFolderDoc || !selectedDocLink) {
      return;
    }

    // TODO: validate the doc's data schema here before adding to our collection
    if (!rootFolderDoc?.docs.find((doc) => doc.url === selectedDocLink.url)) {
      changeRootFolderDoc((doc) =>
        doc.docs.unshift({
          type: selectedDocLink.type,
          name: "Unknown document", // TODO: sync up the name once we load the data
          url: selectedDocLink.url,
        })
      );
    }
  }, [rootFolderDoc, selectedDocLink]);

  return [selectedDocLink, setSelectedDocLink];
};

const docLinkToUrl = (docLink: DocLink): string => {
  const documentId = docLink.url.split(":")[1];
  const name = `${docLink.name.trim().replace(/\s/g, "-").toLowerCase()}-`;

  return `${name}${documentId}?docType=${docLink.type}`;
};
export type SelectedBranch =
  | { type: "main" }
  | {
      type: "branch";
      url: AutomergeUrl;
    };
