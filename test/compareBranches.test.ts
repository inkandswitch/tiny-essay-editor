import assert from "assert";
import { describe, it } from "vitest";
import { getChangesFromMergedBranch } from '../src/os/versionControl/branches.js';
import * as A from "@automerge/automerge/next";

describe("compareBranches", () => {
  it("returns a single change on a branch, with nothing else concurrent on main", () => {
    //  x main
    //   \
    //    \
    //     x branch

    const emptyDoc = A.init<any>();
    const mainDoc = A.change(emptyDoc, (d) => {
      d.content = "hello";
    });
    const baseHeads = A.getHeads(mainDoc);
    const branchDoc = A.change(mainDoc, (d) => {
      d.content = "world";
    });
    const branchHeads = A.getHeads(branchDoc);

    // merge!
    const finalDoc = A.merge(A.clone(branchDoc), A.clone(mainDoc));
    const decodedChanges = A.getAllChanges(finalDoc).map((change) =>
      A.decodeChange(change)
    );

    const result = getChangesFromMergedBranch({
      decodedChangesForDoc: decodedChanges,
      branchHeads,
      // main hasn't moved past the base in this case
      mainHeads: baseHeads,
      baseHeads,
    });

    assert.deepEqual(result, new Set([branchHeads[0]]));
  });

  it("returns 2 changes on a branch, with nothing else concurrent on main", () => {
    //  x main
    //   \
    //    \
    //     x
    //     |
    //     x branch

    const emptyDoc = A.init<any>();
    const baseDoc = A.change(emptyDoc, (d) => {
      d.content = "hello";
    });
    const baseHeads = A.getHeads(baseDoc);

    // make 2 changes on the branch
    const branchChangeHashes = [];
    let branchDoc = A.change(baseDoc, (d) => {
      d.content = "world";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    branchDoc = A.change(branchDoc, (d) => {
      d.content = "yo";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    const branchHeads = A.getHeads(branchDoc);

    // merge!
    const finalDoc = A.merge(A.clone(branchDoc), A.clone(baseDoc));
    const decodedChanges = A.getAllChanges(finalDoc).map((change) =>
      A.decodeChange(change)
    );

    const result = getChangesFromMergedBranch({
      decodedChangesForDoc: decodedChanges,
      branchHeads,
      // main hasn't moved past the base in this case
      mainHeads: baseHeads,
      baseHeads,
    });

    assert.deepEqual(result, new Set(branchChangeHashes));
  });

  it("returns 2 changes on a branch, with some other stuff afterwards on main post-merge", () => {
    //  x main
    //  |\
    //  | \
    //  |  x
    //  |  |
    //  |  x branch
    //  | /
    //  |/
    //  x

    const emptyDoc = A.init<any>();
    const baseDoc = A.change(emptyDoc, (d) => {
      d.content = "hello";
    });
    const baseHeads = A.getHeads(baseDoc);

    // make 2 changes on the branch
    const branchChangeHashes = [];
    let branchDoc = A.change(baseDoc, (d) => {
      d.content = "world";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    branchDoc = A.change(branchDoc, (d) => {
      d.content = "yo";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    const branchHeads = A.getHeads(branchDoc);

    // merge!
    const mergedDoc = A.merge(A.clone(branchDoc), A.clone(baseDoc));

    // do one more thing on main
    const finalDoc = A.change(A.clone(mergedDoc), (d) => {
      d.content = "bar";
    });
    const decodedChanges = A.getAllChanges(finalDoc).map((change) =>
      A.decodeChange(change)
    );

    const result = getChangesFromMergedBranch({
      decodedChangesForDoc: decodedChanges,
      branchHeads,
      mainHeads: A.getHeads(finalDoc),
      baseHeads,
    });

    assert.deepEqual(result, new Set(branchChangeHashes));
  });

  it("returns 2 changes on a branch, with 1 change concurrent on main", () => {
    //     x
    //     |\
    //     | \
    //main x  x
    //        |
    //        x branch

    const emptyDoc = A.init<any>();
    const baseDoc = A.change(emptyDoc, (d) => {
      d.content = "hello";
    });
    const baseHeads = A.getHeads(baseDoc);

    // make 2 changes on the branch
    const branchChangeHashes = [];
    let branchDoc = A.change(A.clone(baseDoc), (d) => {
      d.content = "world";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    branchDoc = A.change(branchDoc, (d) => {
      d.content = "yo";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);
    const branchHeads = A.getHeads(branchDoc);

    const mainDoc = A.change(A.clone(baseDoc), (d) => {
      d.content = "bar";
    });
    const mainHeads = A.getHeads(mainDoc);

    const finalDoc = A.merge(A.clone(branchDoc), A.clone(mainDoc));
    const decodedChanges = A.getAllChanges(finalDoc).map((change) =>
      A.decodeChange(change)
    );

    const result = getChangesFromMergedBranch({
      decodedChangesForDoc: decodedChanges,
      branchHeads,
      mainHeads,
      baseHeads,
    });

    assert.deepEqual(result, new Set(branchChangeHashes));
  });

  it("returns 3 changes on a branch, with 1 change concurrent on main, and main merged into branch", () => {
    // this case is a bit trickier than the ones above.
    // we need to make sure we differentiate between the change that happened on main
    // vs the ones that happened only on the branch

    //     x
    //     |\
    //     | \
    //main x  x
    //      \ |
    //        x
    //        |
    //        x branch

    const emptyDoc = A.init<any>();
    const baseDoc = A.change(emptyDoc, (d) => {
      d.content = "hello";
    });
    const baseHeads = A.getHeads(baseDoc);

    // make 1 changes on the branch
    const branchChangeHashes = [];
    let branchDoc = A.change(A.clone(baseDoc), (d) => {
      d.content = "world";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);

    // 1 change on main
    const mainDoc = A.change(A.clone(baseDoc), (d) => {
      d.content = "bar";
    });
    const mainHeads = A.getHeads(mainDoc);

    // merge main into branch
    branchDoc = A.merge(A.clone(mainDoc), A.clone(branchDoc));

    // make 2 more changes on the branch
    branchDoc = A.change(A.clone(branchDoc), (d) => {
      d.content = "yo";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);

    branchDoc = A.change(A.clone(branchDoc), (d) => {
      d.content = "whee";
    });
    branchChangeHashes.push(A.getHeads(branchDoc)[0]);

    const branchHeads = A.getHeads(branchDoc);

    const finalDoc = A.merge(A.clone(branchDoc), A.clone(mainDoc));
    const decodedChanges = A.getAllChanges(finalDoc).map((change) =>
      A.decodeChange(change)
    );

    const result = getChangesFromMergedBranch({
      decodedChangesForDoc: decodedChanges,
      branchHeads,
      mainHeads,
      baseHeads,
    });

    assert.equal(branchChangeHashes.length, 3);

    assert.deepEqual(result, new Set(branchChangeHashes));
  });
});
