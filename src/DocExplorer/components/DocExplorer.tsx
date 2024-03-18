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
import { setUrlHashForDoc } from "../utils";
import { PatchworkDocEditor } from "@/patchwork/components/PatchworkDocEditor";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { useStaticCallback } from "@/tee/utils";

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

  const {
    selectedDoc,
    selectedDocUrl,
    selectedBranch,
    selectDoc,
    selectBranch,
  } = useSelectedDoc({
    rootFolderDoc,
    changeRootFolderDoc,
  });

  const selectedDocLink = rootFolderDoc?.docs.find(
    (doc) => doc.url === selectedDocUrl
  );

  const selectedDocName = selectedDocLink?.name;

  const addNewDocument = useCallback(
    ({ type }: { type: DocType }) => {
      if (!docTypes[type]) {
        throw new Error(`Unsupported document type: ${type}`);
      }

      const newDocHandle = repo.create();
      newDocHandle.change((doc) =>
        docTypes[type].init(doc as HasPatchworkMetadata<unknown, unknown>, repo)
      );

      if (!rootFolderDoc) {
        return;
      }

      changeRootFolderDoc((doc) =>
        doc.docs.unshift({
          type: type,
          name: "Untitled document",
          url: newDocHandle.url,
        })
      );

      // By updating the URL to the new doc, we'll trigger a navigation
      setUrlHashForDoc({
        docUrl: newDocHandle.url,
        docType: type,
        branch: { type: "main" },
      });
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
    selectedDocUrl,
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
        selectDoc(rootFolderDoc?.docs[itemIndex + 1].url);
      } else if (itemIndex > 1) {
        selectDoc(rootFolderDoc?.docs[itemIndex - 1].url);
      } else {
        selectDoc(null);
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
            selectDoc={selectDoc}
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
              selectedDocUrl={selectedDocUrl}
              selectDoc={selectDoc}
              deleteFromAccountDocList={deleteFromRootFolder}
              setSelectedBranch={selectBranch}
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
                  selectedBranch={selectedBranch}
                  setSelectedBranch={selectBranch}
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

export type UrlHashParams = {
  docUrl: AutomergeUrl;
  docType: DocType;
  branch?: SelectedBranch;
} | null;

const isDocType = (x: string): x is DocType =>
  Object.keys(docTypes).includes(x as DocType);

const parseCurrentUrlHash = (): UrlHashParams => {
  const hash = window.location.hash;

  // This is a backwards compatibility shim for old URLs where we
  // only had one parameter, the Automerge URL.
  // We just assume it's a TEE essay in that case.
  const possibleAutomergeUrl = hash.slice(1);
  if (isValidAutomergeUrl(possibleAutomergeUrl)) {
    return {
      docUrl: possibleAutomergeUrl,
      docType: "essay",
      branch: { type: "main" },
    };
  }

  // Now on to the main logic where we look for a url and type both.
  const parsedHash = queryString.parse(hash);
  const { docUrl, docType, branchUrl } = parsedHash;

  if (typeof docUrl !== "string" || typeof docType !== "string") {
    return null;
  }

  if (typeof docUrl === "string" && !isValidAutomergeUrl(docUrl)) {
    alert(`Invalid Automerge URL in URL: ${parsedHash.docUrl}`);
    return null;
  }

  if (typeof docType === "string" && !isDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

  // NOTE: the URL may contain a branchUrl, which we need to turn into a SelectedBranch value
  // If it's missing, the selected branch is main.
  const selectedBranch: SelectedBranch =
    branchUrl && typeof branchUrl === "string" && isValidAutomergeUrl(branchUrl)
      ? { type: "branch", url: branchUrl }
      : { type: "main" };

  return {
    docUrl,
    docType,
    branch: selectedBranch,
  };
};

// Drive the currently selected doc using the URL hash.
// The philosophy here is that any changes to the selected doc or branch
// flow through the URL hash. This ensures that copying the current URL
// will always correctly point to the right doc + branch.
// To support this, we expose functions for selecting a doc or a branch,
// which route through the URL hash, and then we expose the currently
// selected doc + branch as data values as well.
// The React state for the selection is privately encapsulated and
// is not meant to be directly accessed.
const useSelectedDoc = ({ rootFolderDoc, changeRootFolderDoc }) => {
  const [selectedDocUrl, setSelectedDocUrl] = useState<AutomergeUrl>(null);
  const selectedDocHandle = useHandle(selectedDocUrl);
  const [selectedBranch, setSelectedBranch] = useState<SelectedBranch>({
    type: "main",
  });

  useEffect(() => {
    // @ts-expect-error window global for debugging
    window.handle = selectedDocHandle;
  }, [selectedDocHandle]);

  const [selectedDoc] =
    useDocument<HasPatchworkMetadata<unknown, unknown>>(selectedDocUrl);

  const selectDoc = useCallback(
    (docUrl: AutomergeUrl | null, branch?: SelectedBranch) => {
      const doc = rootFolderDoc.docs.find((doc) => doc.url === docUrl);
      if (!doc) {
        alert(`Could not find document with URL: ${docUrl}`);
        return;
      }
      setUrlHashForDoc({ docUrl, docType: doc.type, branch });
    },
    [rootFolderDoc]
  );

  const selectBranch = useCallback(
    (branch: SelectedBranch) => {
      selectDoc(selectedDocUrl, branch);
    },
    [selectedDocUrl, selectDoc]
  );

  // open a doc given a URL
  const openDocFromUrl = useCallback(
    ({
      docUrl,
      docType,
      branch,
    }: {
      docUrl: AutomergeUrl;
      docType: DocType;
      branch?: SelectedBranch;
    }) => {
      if (!rootFolderDoc) {
        return;
      }

      // First add it to our root folder if it's not there yet
      // TODO: validate the doc's data schema here before adding to our collection
      if (!rootFolderDoc?.docs.find((doc) => doc.url === docUrl)) {
        changeRootFolderDoc((doc) =>
          doc.docs.unshift({
            type: docType,
            name: "Unknown document", // The name will load once we load the doc
            url: docUrl,
          })
        );
      }

      setSelectedDocUrl(docUrl);
      if (branch) {
        setSelectedBranch(branch);
      } else {
        setSelectedBranch({ type: "main" });
      }
    },
    [changeRootFolderDoc, rootFolderDoc]
  );

  // observe the URL hash to change the selected document
  useEffect(() => {
    if (rootFolderDoc === undefined) {
      return;
    }

    const hashChangeHandler = () => {
      const urlParams = parseCurrentUrlHash();
      if (!urlParams) return;
      openDocFromUrl(urlParams);
    };

    hashChangeHandler();

    // Listen for hash changes
    window.addEventListener("hashchange", hashChangeHandler, false);

    // Clean up listener on unmount
    return () => {
      window.removeEventListener("hashchange", hashChangeHandler, false);
    };
  }, [openDocFromUrl, rootFolderDoc !== undefined]);

  return {
    selectedDocUrl,
    selectedDoc,
    selectedBranch,
    selectDoc,
    openDocFromUrl,
    selectBranch,
  };
};
export type SelectedBranch =
  | { type: "main" }
  | {
      type: "branch";
      url: AutomergeUrl;
    };
