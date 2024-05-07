import { datatypes } from "@/datatypes";
import { DocLinkWithFolderPath, FolderDoc } from "@/folders/datatype";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Doc } from "@automerge/automerge/next";
import { useRef, useEffect } from "react";

// This hook syncs doc titles bidirectionally between folder doc links and doc contents.
// - Each datatype can define getTitle and setTitle methods for a given doc schema.
// - In order to figure out which side to sync from/to, the hook keeps around some state
// of previous values on both sides to figure out what changed.

export const useSyncDocTitles = ({
  selectedDoc,
  selectedDocLink,
  repo,
  selectedDocHandle,
  selectDocLink,
}: {
  selectedDoc: Doc<unknown>;
  selectedDocLink: DocLinkWithFolderPath;
  repo: Repo;
  selectedDocHandle: DocHandle<unknown>;
  selectDocLink: (docLink: DocLinkWithFolderPath) => void;
}) => {
  const prevSelectedDocTitleRef = useRef<{
    url: AutomergeUrl;
    fromDoc: string;
    fromLink: string;
  } | null>(null);

  useEffect(() => {
    if (selectedDoc === undefined || selectedDocLink === undefined) {
      return;
    }

    const currentSelectedDocTitle = {
      url: selectedDocLink.url,
      fromDoc: datatypes[selectedDocLink.type].getTitle(selectedDoc),
      fromLink: selectedDocLink.name,
    };

    if (prevSelectedDocTitleRef.current?.url !== selectedDocLink.url) {
      prevSelectedDocTitleRef.current = currentSelectedDocTitle;
    }
    // deref the prev ref and then update it with new values
    const prevSelectedDocTitle = prevSelectedDocTitleRef.current;
    prevSelectedDocTitleRef.current = currentSelectedDocTitle;

    // If the title is the same on both sides, nothing to do
    if (currentSelectedDocTitle.fromDoc === currentSelectedDocTitle.fromLink) {
      return;
    }

    const linkChanged =
      currentSelectedDocTitle.fromLink !== prevSelectedDocTitle?.fromLink;

    // If the link changed, then propagate new title into the doc
    if (linkChanged) {
      if (
        selectedDocLink.name !== currentSelectedDocTitle.fromDoc &&
        datatypes[selectedDocLink.type].setTitle
      ) {
        if (!selectedDocHandle.isReady) {
          return;
        }
        selectedDocHandle.change((doc) => {
          datatypes[selectedDocLink.type].setTitle(
            doc,
            currentSelectedDocTitle.fromLink
          );
        });
      }
      // Re-select the doc link in order to propagate the new title to the URL bar
      selectDocLink(selectedDocLink);
    } else {
      // Otherwise, propagate new title from the doc to the doclink

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
        if (
          existingDocLink &&
          existingDocLink.name !== currentSelectedDocTitle.fromDoc
        ) {
          existingDocLink.name = currentSelectedDocTitle.fromDoc;

          // Re-select the doc link in order to propagate the new title to the URL bar
          selectDocLink({
            ...selectedDocLink,
            name: currentSelectedDocTitle.fromDoc,
          });
        }
      });
    }
  }, [selectedDocLink, repo, selectedDocHandle, selectedDoc, selectDocLink]);
};
