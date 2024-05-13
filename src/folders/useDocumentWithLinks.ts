import { AutomergeUrl } from "@automerge/automerge-repo";
import { useEffect, useMemo, useState } from "react";
import { mapKeys } from "lodash";
import { useDocuments } from "@automerge/automerge-repo-react-hooks";

/** This hook helps with loading a document which contains links to other documents.
 *
 *  Conceptually we want to follow links found in the document and materialize the contents
 *  of the linked documents inside the given document. This process can be recursive too.
 *
 *  Notably, the type of the "raw" automerge document is not the same as the document with links
 *  materialized, so we need to think in terms of those two types separately.
 *
 *  This hook is very flexible and applies to any document schema because the caller provides
 *  arguments which govern its behavior:
 *
 *  @param rootUrl The URL of the root doc to load
 *  @param findLinks A function which crawls the current doc (with links materialized) and returns
 *    the list of all Automerge URLs which we want to load.
 *  @param materializeLinks Given a raw document and a map of data we've loaded for linked docs,
 *    construct a final document with links "materialized" into the data.
 */
export const useDocumentWithLinks = <TRawDoc, TDocWithLinksMaterialized>({
  rootUrl,
  findLinks,
  materializeLinks,
}: {
  rootUrl: AutomergeUrl;
  findLinks: (doc: TDocWithLinksMaterialized) => AutomergeUrl[];
  materializeLinks: (
    doc: TRawDoc,
    loadedDocs: Record<AutomergeUrl, TRawDoc>
  ) => TDocWithLinksMaterialized;
}): {
  doc: TDocWithLinksMaterialized | undefined;
  status: "loading" | "loaded";
} => {
  const [urlsToLoad, setUrlsToLoad] = useState(rootUrl ? [rootUrl] : []);
  const rawDocContentsMap = useDocuments<TRawDoc>(urlsToLoad);
  const docContentsMapWithUrlsAsKeys = useMemo(
    () => mapKeys(rawDocContentsMap, (value, docId) => `automerge:${docId}`),
    [rawDocContentsMap]
  );

  const rootDoc = useMemo(
    () => docContentsMapWithUrlsAsKeys[rootUrl],
    [docContentsMapWithUrlsAsKeys, rootUrl]
  );
  const docWithChildren = useMemo(
    () =>
      rootDoc
        ? materializeLinks(rootDoc, docContentsMapWithUrlsAsKeys)
        : undefined,
    [rootDoc, docContentsMapWithUrlsAsKeys, materializeLinks]
  );

  const urlsToLoadForCurrentDocWithChildren = useMemo(
    () =>
      docWithChildren
        ? Array.from(
            // ensure there are no duplicate urls in the list
            new Set([rootUrl, ...findLinks(docWithChildren)]).values()
          )
        : undefined,
    [docWithChildren, findLinks, rootUrl]
  );

  useEffect(() => {
    if (!rootUrl) {
      setUrlsToLoad([]);
      return;
    }

    if (!rootDoc) {
      setUrlsToLoad([rootUrl]);
      return;
    }

    // Crawl the latest doc to see if we need to load any more URLs.
    // If we find any new doc links we'll add them to the list of URLs to load.
    setUrlsToLoad(urlsToLoadForCurrentDocWithChildren);
  }, [rootUrl, rootDoc, urlsToLoadForCurrentDocWithChildren]);

  const stillLoading =
    !rootDoc ||
    Object.keys(docContentsMapWithUrlsAsKeys).length <
      urlsToLoadForCurrentDocWithChildren.length;

  const status = stillLoading ? "loading" : "loaded";

  return { doc: docWithChildren, status };
};
