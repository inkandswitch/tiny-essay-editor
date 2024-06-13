import { useRootFolderDocWithChildren } from "@/os/explorer/account";
import { DocumentId } from "@automerge/automerge-repo";
import { useDocuments } from "@automerge/automerge-repo-react-hooks";
import { useMemo, useRef, useEffect, useState } from "react";
import { next as A } from "@automerge/automerge";
import { PackageDoc } from "./datatype";

export const usePackageModulesInRootFolder = () => {
  const { flatDocLinks } = useRootFolderDocWithChildren();
  const [modules, setModules] = useState<any[]>([]);

  const packageDocLinks = useMemo(
    () =>
      flatDocLinks ? flatDocLinks.filter((link) => link.type === "pkg") : [],
    [flatDocLinks]
  );

  const packageDocs = useDocuments<PackageDoc>(
    packageDocLinks.map((link) => link.url)
  );

  const packageDocsRef = useRef<Record<DocumentId, PackageDoc>>();
  packageDocsRef.current = packageDocs;
  useEffect(() => {
    (async () => {
      const modules = await Promise.all(
        Object.entries(packageDocs).map(async ([docId, packageDoc]) => {
          const { source } = packageDoc;
          const heads = A.getHeads(packageDoc);

          const sourceUrl =
            source.type === "url"
              ? source.url
              : `https://automerge/${docId}/source/index.js?heads=${heads.join(
                  ","
                )}`;

          return import(sourceUrl);
        })
      );

      // skip if packageDocs has changed in the meantime
      if (packageDocs !== packageDocsRef.current) {
        return;
      }

      setModules(modules);
    })();
  }, [packageDocs]);

  return modules;
};
