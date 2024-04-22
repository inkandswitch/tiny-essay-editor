import {
  AutomergeUrl,
  DocumentId,
  isValidAutomergeUrl,
} from "@automerge/automerge-repo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
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
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";

import queryString from "query-string";
import { setUrlHashForDoc } from "../utils";
import { useCurrentUrlPath } from "../navigation";

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
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();

  const [showSidebar, setShowSidebar] = useState(true);

  const [selectedDocLink, setSelectedDocLink] = useSelectedDocLink({
    rootFolderDoc,
    changeRootFolderDoc,
  });

  const [selectedDoc] = useDocument(selectedDocLink?.url);

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

      const newDocHandle = repo.create();
      newDocHandle.change((doc) => docTypes[type].init(doc));

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
      const title = await docTypes[selectedDocType].getTitle(selectedDoc);

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
          {
            <Sidebar
              selectedDocUrl={selectedDocUrl}
              selectDocLink={setSelectedDocLink}
              hideSidebar={() => setShowSidebar(false)}
              addNewDocument={addNewDocument}
            />
          }
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
              selectedDocLink={selectedDocLink}
              selectDocLink={setSelectedDocLink}
              deleteFromAccountDocList={deleteFromRootFolder}
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
                <ToolComponent docUrl={selectedDocUrl} key={selectedDocUrl} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const isValidDocType = (x: string): x is DocType =>
  Object.keys(docTypes).includes(x as DocType);

const parseUrlPath = (path: string): DocLink | null => {
  const match = path.match(/^\/(?<name>.*-)?(?<docId>\w+)\/(?<docType>\w+)$/);

  if (!match) {
    return;
  }

  const { docType, docId, name } = match.groups;
  const docUrl = `automerge:${docId}` as AutomergeUrl;

  if (!isValidAutomergeUrl(docUrl)) {
    alert(`Invalid doc id in URL: ${docUrl}`);
    return null;
  }

  if (!isValidDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

  return {
    url: docUrl,
    type: docType,
    name,
  };
};

const parseUrlHash = (hash: string): DocLink => {
  // This is a backwards compatibility shim for old URLs where we
  // only had one parameter, the Automerge URL.
  // We just assume it's a TEE essay in that case.
  const possibleAutomergeUrl = hash.slice(1);
  if (isValidAutomergeUrl(possibleAutomergeUrl)) {
    return {
      url: possibleAutomergeUrl,
      name: "",
      type: "essay",
    };
  }

  // Now on to the main logic where we look for a url and type both.
  const parsedHash = queryString.parse(hash);
  const { docUrl, docType } = parsedHash;

  if (typeof docUrl !== "string" || typeof docType !== "string") {
    return null;
  }

  if (typeof docUrl === "string" && !isValidAutomergeUrl(docUrl)) {
    alert(`Invalid Automerge URL in URL: ${parsedHash.docUrl}`);
    return null;
  }

  if (typeof docType === "string" && !isValidDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

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
  const currentUrlPath = useCurrentUrlPath();

  const setSelectedDocLink = (
    docLink: DocLink,
    options: NavigationNavigateOptions = {}
  ) => {
    if (
      selectedDocLink &&
      selectedDocLink.url === docLink.url &&
      selectedDocLink.type == docLink.type
    ) {
      return;
    }

    const documentId = docLink.url.split(":")[1];

    const name = docLink.name
      ? `${docLink.name.trim().replace(/\s/g, "-").toLowerCase()}-`
      : "";

    console.log("name", name);

    navigation.navigate(`/${name}${documentId}/${docLink.type}`, options);
  };

  const selectedDocLink = useMemo<DocLink | null>(() => {
    if (!rootFolderDoc) {
      return;
    }

    // todo: handle old url
    /* if (currentUrlPath === "/" || currentUrlPath === "") {
      if (window.location.hash) {
        const params = parseUrlHash(window.location.hash);

        if (params) {
          removeHash();
          setUrl(params, { history: "replace" });
        }

        return params;
      }
    } */

    const { type, url } = parseUrlPath(currentUrlPath) ?? {};
    return {
      name:
        rootFolderDoc.docs.find((docLink) => docLink.url === url)?.name ??
        "Unknown document",
      type,
      url,
    };
  }, [currentUrlPath, rootFolderDoc]);

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

const removeHash = () => {
  history.replaceState(
    "",
    document.title,
    window.location.pathname + window.location.search
  );
};
