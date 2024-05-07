import { AutomergeUrl } from "@automerge/automerge-repo";
import { useCallback } from "react";
import {
  DocLinkWithFolderPath,
  FolderDoc,
  FolderDocWithChildren,
} from "./datatype";
import { useDocumentWithLinks } from "./useDocumentWithLinks";

export type FolderDocWithMetadata = {
  rootFolderUrl: AutomergeUrl;
  flatDocLinks: DocLinkWithFolderPath[];
  doc: FolderDocWithChildren;
  status: "loading" | "loaded";
};

// Returns a flattened list of doc links in the folder tree, as an easy lookup index.
// Each doclink also gets annotated with its parent in the tree.
// NB: This returns undefined until we've recursively loaded all folders in our tree.
// The reason is that when we load a new doc, we need to decide whether to load it from an
// existing place in our folder hierarchy, or to create a new link to it in the root folder.
// We can't make this determination before recursively loading folder contents.
const computeFlattenedDocLinks = ({
  folderPath,
  doc,
  status,
}: {
  folderPath: AutomergeUrl[];
  doc: FolderDocWithChildren;
  status: "loading" | "loaded";
}): DocLinkWithFolderPath[] | undefined => {
  if (status === "loading") {
    return undefined;
  }

  return doc?.docs.flatMap((docLink) =>
    docLink.type === "folder" && docLink.folderContents
      ? [
          { ...docLink, folderPath: folderPath },
          ...computeFlattenedDocLinks({
            doc: docLink.folderContents,
            status,
            folderPath: [...folderPath, docLink.url],
          }),
        ]
      : { ...docLink, folderPath }
  );
};

// This hook recursively traverses a tree of nested folders and loads folder contents.
export function useFolderDocWithChildren(
  rootFolderUrl: AutomergeUrl | undefined
): FolderDocWithMetadata {
  const materializeLinks = useCallback(
    (
      folder: FolderDoc,
      loadedDocs: Record<AutomergeUrl, FolderDoc>
    ): FolderDocWithChildren => {
      return {
        ...folder,
        docs: folder.docs.map((link) => {
          if (loadedDocs[link.url]) {
            return {
              ...link,
              folderContents: materializeLinks(
                loadedDocs[link.url],
                loadedDocs
              ),
            };
          } else {
            return link;
          }
        }),
      };
    },
    []
  );

  const findLinks = useCallback((folderDoc: FolderDocWithChildren) => {
    const urls = [];
    for (const child of folderDoc.docs) {
      if (child.type === "folder") {
        urls.push(child.url);
      }
      if (child.folderContents) {
        urls.push(...findLinks(child.folderContents));
      }
    }

    return urls;
  }, []);

  const docWithLinks = useDocumentWithLinks({
    rootUrl: rootFolderUrl,
    findLinks: findLinks,
    materializeLinks: materializeLinks,
  });

  const flatDocLinks = computeFlattenedDocLinks({
    doc: docWithLinks.doc,
    status: docWithLinks.status,
    folderPath: [rootFolderUrl],
  });

  // flatDocLinks is a flat array of all the docs in the hierarchy
  return {
    ...docWithLinks,
    rootFolderUrl,
    flatDocLinks,
  };
}
