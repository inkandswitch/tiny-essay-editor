import { Heads, getHeads } from "@automerge/automerge/next";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Branchable } from "./schema";

export const createBranch = <DocType extends Branchable>({
  repo,
  handle,
  name,
  heads,
  createdBy,
}: {
  repo: Repo;
  handle: DocHandle<DocType>;
  name: string;
  heads: Heads;
  createdBy: AutomergeUrl;
}) => {
  const branchHandle = repo.clone<DocType>(handle);
  const doc = handle.docSync();
  const branchHeads = heads ?? getHeads(doc);
  const branchPointer = {
    name: name ?? `Branch #${(doc?.branchMetadata?.branches?.length ?? 0) + 1}`,
    createdAt: Date.now(),
    createdBy,
    branchHeads,
    url: branchHandle.url,
  };

  // This is a terribly intricate dance because we store the draft metadata in the doc itself.
  // We need to make sure that the copyheads for the draft doc is set after the original doc has the new draft metadata.
  // We also need to merge the original handle into the draft after we update the draft metadata.
  // This can all be avoided by storing draft metadata outside of the document itself.
  // Also obviously we should extract this out of this view component...

  handle.change((doc) => {
    doc.branchMetadata.branches.unshift(branchPointer);
  });

  branchHandle.merge(handle);

  branchHandle.change((doc) => {
    doc.branchMetadata.source = {
      url: handle.url,
      branchHeads,
    };
  });

  return branchHandle;
};

export const mergeBranch = <DocType extends Branchable>({
  docHandle,
  branchHandle,
  mergedBy,
}: {
  docHandle: DocHandle<DocType>;
  branchHandle: DocHandle<DocType>;
  mergedBy: AutomergeUrl;
}) => {
  docHandle.merge(branchHandle);
  docHandle.change((doc) => {
    const branch = doc.branchMetadata.branches.find(
      (branch) => branch.url === branchHandle.url
    );

    if (!branch) {
      console.warn("Branch not found in doc metadata", branchHandle.url);
    }

    branch.mergeMetadata = {
      mergedAt: Date.now(),
      mergeHeads: getHeads(branchHandle.docSync()),
      mergedBy,
    };
  });
};

export const deleteBranch = <DocType extends Branchable>({
  docHandle,
  branchUrl,
}: {
  docHandle: DocHandle<DocType>;
  branchUrl: AutomergeUrl;
}) => {
  docHandle.change((doc) => {
    const index = doc.branchMetadata.branches.findIndex(
      (copy) => copy.url === branchUrl
    );
    if (index !== -1) {
      doc.branchMetadata.branches.splice(index, 1);
    }
  });
};
