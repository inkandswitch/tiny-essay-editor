import { useRootFolderDocWithChildren } from "@/os/explorer/account";
import { AutomergeUrl, DocumentId } from "@automerge/automerge-repo";
import { useDocuments } from "@automerge/automerge-repo-react-hooks";
import { useMemo, useRef, useEffect, useState } from "react";
import { next as A } from "@automerge/automerge";
import { PackageDoc } from "./datatype";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";

type Package = {
  module: any;
  sourceDocUrl?: AutomergeUrl;
};

export const usePackageModulesInRootFolder = (): Package[] => {
  const { flatDocLinks } = useRootFolderDocWithChildren();
  const [modules, setModules] = useState<Package[]>([]);

  const packageDocLinks = useMemo(
    () =>
      flatDocLinks ? flatDocLinks.filter((link) => link.type === "pkg") : [],
    [flatDocLinks]
  );

  const packageDocUrls = useMemo(
    () => packageDocLinks.map((link) => link.url),
    [packageDocLinks]
  );
  const packageDocs = useDocuments<PackageDoc>(packageDocUrls);

  const branchUrls = useMemo(
    () =>
      (
        Object.values(packageDocs) as HasVersionControlMetadata<
          unknown,
          unknown
        >[]
      ).flatMap((doc) =>
        doc.branchMetadata?.branches
          .filter((branch) => !branch.mergeMetadata)
          .map((branch) => branch.url)
      ),
    [packageDocs]
  );

  const packageDocsOnBranches = useDocuments<PackageDoc>(branchUrls);

  const allPackageDocs = useMemo(
    () => ({ ...packageDocs, ...packageDocsOnBranches }),
    [packageDocs, packageDocsOnBranches]
  );

  const packageDocsRef = useRef<Record<DocumentId, PackageDoc>>();
  packageDocsRef.current = packageDocs;
  useEffect(() => {
    (async () => {
      const modules = await Promise.all(
        Object.entries(allPackageDocs).map(async ([docId, packageDoc]) => {
          const { source } = packageDoc;
          const heads = A.getHeads(packageDoc);

          const sourceUrl =
            source.type === "url"
              ? source.url
              : `https://automerge/${docId}/source/index.js?heads=${heads.join(
                  ","
                )}`;

          const sourcePackage = packageDoc.branchMetadata.source
            ? packageDocs[packageDoc.branchMetadata.source.url.slice(10)]
            : undefined;

          return {
            module: await import(sourceUrl),
            sourceDocUrl: sourcePackage
              ? sourcePackage.branchMetadata.branches.find((branch) =>
                  branch.url.includes(docId)
                )
              : undefined,
          };
        })
      );

      // skip if packageDocs has changed in the meantime
      if (packageDocs !== packageDocsRef.current) {
        return;
      }

      setModules(modules);
    })();
  }, [allPackageDocs]);

  return modules;
};
