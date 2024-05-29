import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { useDataTypeLoaders } from "../../datatypes";
import { DocLinkWithFolderPath, FolderDoc } from "@/datatypes/folder";
import { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { Doc } from "@automerge/automerge/next";
import { useRef, useEffect } from "react";

// This hook keeps the name of the link synced with the title of the document.
// The update is triggered every time the selected doc changes.
// Only the title of the currently selected document is synced.
// This means that the names of doc links can become out of synce but they are
// updated once the users opens the link again.

export const useSyncDocTitle = ({
  selectedDoc,
  selectedDocLink,
  repo,
  selectDocLink,
}: {
  selectedDoc: Doc<HasVersionControlMetadata<unknown, unknown>>;
  selectedDocLink: DocLinkWithFolderPath;
  repo: Repo;
  selectDocLink: (docLink: DocLinkWithFolderPath) => void;
}) => {
  // counter is incremented each time the title is re computed so we can detect async operations that should be aborted because they are based on old state
  const counterRef = useRef(0);
  const selectedDocTitleRef = useRef<{ url: AutomergeUrl; title?: string }>();

  const dataTypeLoaders = useDataTypeLoaders();

  useEffect(() => {
    if (!selectedDocLink || !selectedDoc) {
      selectedDocTitleRef.current = null;
      return;
    }

    // reset title if url has changed
    if (selectedDocTitleRef.current?.url !== selectedDocLink?.url) {
      selectedDocTitleRef.current = { url: selectedDocLink.url };
    }

    let counter = (counterRef.current = counterRef.current + 1);

    // load title
    dataTypeLoaders[selectedDocLink.type]
      .load()
      .then((dataType) => dataType.getTitle(selectedDoc, repo))
      .then((title) => {
        // do nothing if selectedDocLink has changed in between
        // or if this promise resolved after newer update
        if (
          selectedDocLink.url !== selectedDocTitleRef.current.url ||
          counter !== counterRef.current
        ) {
          return;
        }

        // title has changed compared to previous computation
        if (title !== selectedDocTitleRef.current?.title) {
          selectedDocTitleRef.current.title = title;

          const parentFolderUrl =
            selectedDocLink.folderPath[selectedDocLink.folderPath.length - 1];
          if (!parentFolderUrl) {
            console.warn(
              "expected to find a parent folder for selected doc",
              selectedDocLink.url
            );
          }

          const folderHandle = repo.find<FolderDoc>(parentFolderUrl);
          folderHandle.change((doc) => {
            const existingDocLink = doc.docs.find(
              (link) => link.url === selectedDocLink.url
            );
            // check if the doc link matches the current title
            if (
              existingDocLink &&
              existingDocLink.name &&
              existingDocLink.name !== title
            ) {
              existingDocLink.name = title;

              // update url
              selectDocLink({ ...selectedDocLink, name: title });
            }
          });
        }
      });
  }, [selectedDoc, selectedDocLink?.url]);
};
