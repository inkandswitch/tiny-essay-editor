import {
  AutomergeUrl,
  DocumentId,
  Repo,
  isValidAutomergeUrl,
  stringifyAutomergeUrl,
} from "@automerge/automerge-repo";
import { useEffect, useMemo, useState } from "react";
import { DocLink, DocLinkWithFolderPath, FolderDoc } from "@/packages/folder";
import { useCurrentUrl } from "../navigation";
import queryString from "query-string";
import { FolderDocWithMetadata } from "@/packages/folder/hooks/useFolderDocWithChildren";
import { isEqual } from "lodash";
import { DatatypeId } from "../../datatypes";
import { useDocument } from "@automerge/automerge-repo-react-hooks";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";

const docLinkToUrl = (docLink: DocLink): string => {
  const documentId = docLink.url.split(":")[1];

  let url = "";

  // add name (optional)
  if (docLink.name) {
    url += getUrlSafeName(docLink.name);
  }

  // add branch name (optional)
  if (docLink.branchName && docLink.branchUrl) {
    url += `-(${getUrlSafeName(docLink.branchName)})`;
  }

  // if name part is not empty add separator
  if (url !== "") {
    url += "--";
  }

  // add id & doctype
  url += `${documentId}?type=${docLink.type}`;

  // add branchUrl (optional)
  if (docLink.branchUrl) {
    url += `&branchUrl=${docLink.branchUrl}`;
  }

  return url;
};

// Turn names into a readable url safe string
// - replaces any sequence of alpha numeric characters with a single "-"
// - limits length to 100 characters
export const getUrlSafeName = (value: string) => {
  let urlSafeName = value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 100);

  if (urlSafeName.endsWith("-")) {
    urlSafeName = urlSafeName.slice(0, -1);
  }

  if (urlSafeName.startsWith("-")) {
    urlSafeName = urlSafeName.slice(1);
  }

  return urlSafeName;
};

// Parse older URL formats and map them into our newer formatu
const parseLegacyUrl = (
  url: URL
): Omit<DocLink, "name" | "branchName"> | null => {
  // First handle very old URLs that only had an Automerge URL:
  // domain.com/automerge:12345
  const possibleAutomergeUrl = url.pathname.slice(1);
  if (isValidAutomergeUrl(possibleAutomergeUrl)) {
    return {
      url: possibleAutomergeUrl,
      type: "essay" as DatatypeId,
    };
  }

  // Now on to the main logic where we look for URLs of the form:
  // domain.com/#?docUrl=automerge:12345&docType=essay&branchUrl
  const { docUrl, docType, branchUrl } = queryString.parse(
    url.pathname.slice(1)
  );

  if (typeof docUrl !== "string" || typeof docType !== "string") {
    return null;
  }

  if (typeof docUrl === "string" && !isValidAutomergeUrl(docUrl)) {
    alert(`Invalid Automerge URL in URL: ${docUrl}`);
    return null;
  }

  if (typeof branchUrl === "string" && !isValidAutomergeUrl(branchUrl)) {
    alert(`Invalid branch in URL: ${branchUrl}`);
    return null;
  }

  return {
    url: docUrl,
    type: docType as DatatypeId,
    branchUrl: branchUrl as AutomergeUrl,
  };
};

const parseUrl = (url: URL): Omit<DocLink, "name"> | null => {
  const match = url.pathname.match(
    /^\/([a-z-A-Z0-9\-]+(\((?<branchName>[a-zA-Z0-9\-]+)\))?--)?(?<docId>\w+)$/
  );

  if (!match) {
    return;
  }

  const { docId, branchName } = match.groups;

  const docUrl = stringifyAutomergeUrl(docId as DocumentId);
  if (!isValidAutomergeUrl(docUrl)) {
    alert(`Invalid doc id in URL: ${docUrl}`);
    return null;
  }

  const datatypeId = (url.searchParams.get("type") ??
    url.searchParams.get("docType")) as DatatypeId; // use legacy docType as a fallback

  const branchUrl = url.searchParams.get("branchUrl");
  if (branchUrl && !isValidAutomergeUrl(branchUrl)) {
    alert(`Invalid branch in URL: ${branchUrl}`);
    return null;
  }

  return {
    url: docUrl,
    type: datatypeId,
    branchUrl: branchUrl as AutomergeUrl,
    branchName,
  };
};

// This hook manages the currently selected doc shown in the interface.
// It may look more complex than necessary, but that's because we take some
// care with how we manage selection state and the URL hash:
//
// - Selection state is primarily stored in the URL hash and driven by URL changes.
//   Even when we set selection within the app, we do so by updating the URL.
//   This reduces the risk of the URL and the selected doc getting out of sync,
//   which simplifies dataflow and also reduces risk of user sharing the wrong doc.
// - There is an exception to the above: while we can store the currently selected
//   docURL in the URL hash, we can't store the folder path leading to it, because
//   that could leak folders that aren't meant to be shared when sharing the URL.
//   As a result, we store the folder path in React state, and then reassemble it
//   together with the URL hash when determining the selected doc.
//
export const useSelectedDocLink = ({
  folderDocWithMetadata,
  repo,
}: {
  folderDocWithMetadata: FolderDocWithMetadata | undefined;
  repo: Repo;
}): {
  selectedDocLink: DocLinkWithFolderPath | undefined;
  // todo: should the folder path be optional?
  selectDocLink: (docLink: DocLinkWithFolderPath) => void;
} => {
  // parse the current URL
  const currentUrl = useCurrentUrl();
  const urlParams = useMemo(() => parseUrl(currentUrl), [currentUrl]);

  const [doc] = useDocument<HasVersionControlMetadata<unknown, unknown>>(
    urlParams?.url
  );

  // lookup the branch name
  const branchUrl = urlParams?.branchUrl;
  const branchMetadata = doc?.branchMetadata;
  const branchName = useMemo(() => {
    if (!branchMetadata || !branchUrl) {
      return;
    }

    const branch = doc.branchMetadata.branches.find((b) => b.url === branchUrl);

    return branch?.name;
  }, [branchMetadata, branchUrl]);

  // NOTE: this should not be externally exposed, it's just a way to store
  // the folder path to the selection outside the URL.
  const [
    selectedDocLinkDangerouslyBypassingURL,
    setSelectedDocLinkDangerouslyBypassingURL,
  ] = useState<DocLinkWithFolderPath | undefined>();

  const selectedDocLink: DocLinkWithFolderPath = useMemo(() => {
    if (!urlParams || !urlParams.url) {
      return undefined;
    }

    const previousDocLink = selectedDocLinkDangerouslyBypassingURL;
    const previousFolderPath: AutomergeUrl[] = previousDocLink
      ? previousDocLink.type == "folder"
        ? previousDocLink.folderPath.concat(previousDocLink.url)
        : previousDocLink.folderPath
      : [];

    const matches = folderDocWithMetadata?.flatDocLinks?.filter(
      (doc) => doc.url === urlParams?.url
    );

    if (!matches) {
      return;
    }

    let linkInPath: DocLinkWithFolderPath;

    for (let i = previousFolderPath.length; i >= 0; i--) {
      const comparisonPath = previousFolderPath.slice(0, i);

      linkInPath = matches.find((match) =>
        isEqual(match.folderPath, comparisonPath)
      );

      if (linkInPath) {
        break;
      }
    }

    const link = linkInPath ?? matches[0];

    return link && urlParams.branchUrl
      ? {
          ...link,
          branchUrl: urlParams.branchUrl,
          branchName,
        }
      : link;
  }, [
    urlParams,
    branchName,
    folderDocWithMetadata?.flatDocLinks,
    selectedDocLinkDangerouslyBypassingURL,
  ]);

  const selectDocLink = (docLink: DocLinkWithFolderPath | null) => {
    if (!docLink) {
      setSelectedDocLinkDangerouslyBypassingURL(undefined);
      window.location.hash = "";
      return;
    }

    setSelectedDocLinkDangerouslyBypassingURL(docLink);
    window.location.hash = docLinkToUrl(docLink);
  };

  // Add the doc to our collection if we don't have it
  useEffect(() => {
    if (
      !folderDocWithMetadata.flatDocLinks ||
      !urlParams?.url ||
      !urlParams?.type
    ) {
      return;
    }
    if (
      !folderDocWithMetadata.flatDocLinks.find(
        (doc) => doc.url === urlParams.url
      )
    ) {
      repo.find<FolderDoc>(folderDocWithMetadata.rootFolderUrl).change((doc) =>
        doc.docs.unshift({
          type: urlParams.type,
          // The name will be synced in here once the doc loads
          name: "Loading...",
          url: urlParams.url,
        })
      );
    }
  }, [folderDocWithMetadata, urlParams, repo]);

  // Redirect legacy urls to our current URL format
  useEffect(() => {
    if (currentUrl && !urlParams) {
      const legacyUrlParams = parseLegacyUrl(currentUrl);
      if (!legacyUrlParams) {
        return;
      }
      const { url, type, branchUrl } = legacyUrlParams;

      if (url) {
        setSelectedDocLinkDangerouslyBypassingURL(undefined);
        window.location.hash = docLinkToUrl({ url, type, name: "", branchUrl });
      }
    }
  }, [currentUrl, urlParams]);

  // sync the branch name with the url
  useEffect(() => {
    if (!urlParams) {
      return;
    }

    if (branchName) {
      const urlSafeName = getUrlSafeName(branchName);

      if (urlParams.branchName !== urlSafeName) {
        window.location.hash = docLinkToUrl({ ...selectedDocLink, branchName });
      }
      return;
    }

    if (!urlParams.branchUrl && branchName) {
      window.location.hash = docLinkToUrl({
        ...selectedDocLink,
        branchName: null,
      });
    }
  }, [branchName, urlParams?.branchName]);

  useEffect(() => {
    if (!selectedDocLink) {
      return;
    }

    // @ts-expect-error window global
    window.handle = repo.find(selectedDocLink.url);
  }, [selectedDocLink]);

  return {
    selectedDocLink,
    selectDocLink,
  };
};

// In most cases this function should be used to link to documents instead of using useSelectedDocLink()
// With this function you don't have to specify the folderPath, instead ambiguity will be resolved implicitly.
//
// If the same document is linked multiple times in the folder hierarchy this function will open
// the document that's closest to the currently opened document
//
// Example:

// we call selectDocLink on Document 2
//
// Root Folder
// |--- Folder A
// |    |--- Document 1 <-- currently active
// |    |--- Document 2 <-- this document will be opened
// |
// |--- Folder B
// |    |--- Document 3
// |    |--- Document 2
//
export const selectDocLink = (docLink: DocLink) => {
  location.hash = docLinkToUrl(docLink);
};
