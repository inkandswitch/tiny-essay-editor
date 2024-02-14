import * as A from "@automerge/automerge/next";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Branchable } from "./schema";
import { getStringCompletion } from "@/llm";
import { MarkdownDoc } from "@/tee/schema";

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

  /** The heads which the branch should start at.
   *  If undefined the branch will start from the current doc heads
   */
  heads?: A.Heads;
  createdBy: AutomergeUrl;
}) => {
  //
  // This code should work but doesn't, not sure why yet? ----- GL 2/14
  // We should be taking the specified heads into account when creating a branch
  //
  /* automerge-repo doesn't have a built-in way of cloning at a given heads.
     So we make a fresh handle and reach in and update its contents. */
  // const docAtHeads = view(handle.docSync(), heads);
  // const branchHandle = repo.create();
  // branchHandle.update(() => {
  //   return clone(docAtHeads);
  // });
  //----------------------------------------------------------------

  const branchHandle = repo.clone(handle);
  const doc = handle.docSync();
  const branchHeads = heads ?? A.getHeads(doc);
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
      mergeHeads: A.getHeads(branchHandle.docSync()),
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

export const suggestBranchName = async ({
  doc,
  branchDoc,
  branchUrl,
}: {
  doc: MarkdownDoc;
  branchDoc: MarkdownDoc;
  branchUrl: AutomergeUrl;
}): Promise<string> => {
  const branch = doc.branchMetadata.branches.find(
    (branch) => branch.url === branchUrl
  );

  const beforeDoc = A.view(doc, branch.branchHeads).content;
  const afterDoc = branchDoc.content;

  const prompt = `
Below are two versions of a JSON document, before and after some changes were made.
Provide three possible short descriptions (about 2 to 10 words) that describe the changes made.
Return just the three descriptions, separated by newlines, no other text.
Vary the lengths from very brief (3 words, quick overview) to slightly longer (8-10 words, more detailed).

BEFORE:

${JSON.stringify(beforeDoc)}

AFTER:

${JSON.stringify(afterDoc)}
`;

  const result = await getStringCompletion(prompt);

  return result;
};
