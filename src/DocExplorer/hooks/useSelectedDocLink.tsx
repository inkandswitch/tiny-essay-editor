import {
  AutomergeUrl,
  DocumentId,
  Repo,
  isValidAutomergeUrl,
  stringifyAutomergeUrl,
} from "@automerge/automerge-repo";
import { useEffect, useMemo, useState } from "react";
import {
  DocLink,
  DocLinkWithFolderPath,
  FolderDoc,
} from "../../folders/datatype";
import { useCurrentUrl } from "../navigation";
import queryString from "query-string";
import { FolderDocWithMetadata } from "@/folders/useFolderDocWithChildren";
import { isEqual } from "lodash";
import { DocType, docTypes } from "../doctypes";

const docLinkToUrl = (docLink: DocLink): string => {
  const documentId = docLink.url.split(":")[1];
  const name = `${docLink.name.trim().replace(/\s/g, "-").toLowerCase()}-`;

  return `${name}${documentId}?docType=${docLink.type}`;
};

const isDocType = (x: string): x is DocType =>
  Object.keys(docTypes).includes(x as DocType);

// Parse older URL formats and map them into our newer formatu
const parseLegacyUrl = (
  url: URL
): { url: AutomergeUrl; type: DocType } | null => {
  // First handle very old URLs that only had an Automerge URL:
  // domain.com/automerge:12345
  const possibleAutomergeUrl = url.pathname.slice(1);
  if (isValidAutomergeUrl(possibleAutomergeUrl)) {
    return {
      url: possibleAutomergeUrl,
      type: "essay",
    };
  }

  // Now on to the main logic where we look for URLs of the form:
  // domain.com/#?docUrl=automerge:12345&docType=essay
  const { docUrl, docType } = queryString.parse(url.pathname.slice(1));

  if (typeof docUrl !== "string" || typeof docType !== "string") {
    return null;
  }

  if (typeof docUrl === "string" && !isValidAutomergeUrl(docUrl)) {
    alert(`Invalid Automerge URL in URL: ${docUrl}`);
    return null;
  }

  if (typeof docType === "string" && !isDocType(docType)) {
    alert(`Invalid doc type in URL: ${docType}`);
    return null;
  }

  return {
    url: docUrl,
    type: docType,
  };
};

const parseUrl = (url: URL): Omit<DocLink, "name"> | null => {
  const match = url.pathname.match(/^\/(?<name>.*-)?(?<docId>\w+)$/);

  if (!match) {
    return;
  }

  const { docId } = match.groups;
  const docType = url.searchParams.get("docType");
  const docUrl = stringifyAutomergeUrl(docId as DocumentId);

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

  // NOTE: this should not be externally exposed, it's just a way to store
  // the folder path to the selection outside the URL.
  const [
    selectedDocLinkDangerouslyBypassingURL,
    setSelectedDocLinkDangerouslyBypassingURL,
  ] = useState<DocLinkWithFolderPath | undefined>();

  const selectedDocLink = useMemo(() => {
    if (!urlParams || !urlParams.url) {
      return undefined;
    }

    return folderDocWithMetadata?.flatDocLinks?.find((doc) => {
      const urlMatches = doc.url === urlParams?.url;
      const folderPathMatches =
        // If we don't have a selected folder path, then just take the first link we find
        !selectedDocLinkDangerouslyBypassingURL ||
        isEqual(
          doc.folderPath,
          selectedDocLinkDangerouslyBypassingURL?.folderPath
        );
      return urlMatches && folderPathMatches;
    });
  }, [
    urlParams,
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
        (doc) => doc.url === urlParams?.url
      )
    ) {
      repo.find<FolderDoc>(folderDocWithMetadata.rootFolderUrl).change((doc) =>
        doc.docs.unshift({
          type: urlParams?.type,
          // The name will be synced in here once the doc loads
          name: "Loading...",
          url: urlParams?.url,
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
      const { url, type } = legacyUrlParams;

      if (url) {
        window.location.hash = docLinkToUrl({ url, type, name: "" });
      }
    }
  }, [currentUrl, urlParams]);

  return {
    selectedDocLink,
    selectDocLink,
  };
};
