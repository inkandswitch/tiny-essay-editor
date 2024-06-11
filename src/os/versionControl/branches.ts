import * as A from "@automerge/automerge/next";
import { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { Branch, Branchable } from "./schema";
import { getStringCompletion } from "@/os/lib/llm";
import { MarkdownDoc } from "@/packages/essay";
import { Hash } from "@automerge/automerge-wasm";

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
}): Branch => {
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

  return branchPointer;
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

/** Returns 2 lists of change hashes present in one branch but not the other
 *  Framed in terms of "branch" and "main" but works fine for any 2 branches
 *
 * @param decodedChangesForDoc - The changes for the document
 *   (we pass in the decoded changes because we've already done this work elsewhere
 *   and it's expensive to redo it if we pass in the document itself)
 * @param branchHeads - The heads of the branch
 * @param mainHeads - The heads of the main document
 * @param baseHeads - The heads of the point where this branch diverged from main.
 *                    This is technically only needed for performance reasons --
 *                    it lets us cutoff our search of the change DAG without going all the way to the root.
 */
export const getChangesFromMergedBranch = ({
  decodedChangesForDoc,
  branchHeads,
  mainHeads,
  baseHeads,
}: {
  decodedChangesForDoc: A.DecodedChange[];
  branchHeads: A.Heads;
  mainHeads: A.Heads;
  baseHeads: A.Heads;
}): Set<Hash> => {
  const changesInMain = getHashesBetweenHeads({
    decodedChanges: decodedChangesForDoc,
    // This is a bit subtle so it's worth explaining.
    // We can't let changes from the branch be included in the "changes in main"
    // So we start a search backwards from our "to heads" which is latest main;
    // our "from heads" which we abort at is: either the base heads, or the branch heads.
    fromHeads: [...baseHeads, ...branchHeads],
    toHeads: mainHeads,
  });
  const changesInBranch = getHashesBetweenHeads({
    decodedChanges: decodedChangesForDoc,
    fromHeads: baseHeads,
    toHeads: branchHeads,
  });

  return new Set([...changesInBranch].filter((x) => !changesInMain.has(x)));
};

const getHashesBetweenHeads = ({
  decodedChanges,
  fromHeads,
  toHeads,
}: {
  decodedChanges: A.DecodedChange[];
  fromHeads: A.Heads;
  toHeads: A.Heads;
}): Set<Hash> => {
  const hashes = new Set<Hash>();
  const workQueue = structuredClone(toHeads);

  while (workQueue.length > 0) {
    const hash = workQueue.shift();
    const change = decodedChanges.find((change) => change.hash === hash);
    if (!change) {
      throw new Error("Change not found in changes");
    }
    // todo: is this right? any head in the from heads stops the traversal?
    if (fromHeads.includes(change.hash)) {
      break;
    }
    hashes.add(hash);
    workQueue.push(...change.deps);
  }

  return hashes;
};
