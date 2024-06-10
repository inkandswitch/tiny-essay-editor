import { AutomergeUrl, PeerId, Repo } from "@automerge/automerge-repo";
import { DummyStorageAdapter } from "@automerge/automerge-repo/helpers/DummyStorageAdapter.js";
import { render, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepoContext } from "@automerge/automerge-repo-react-hooks";
import { useFolderDocWithChildren } from "@/datatypes/folder/hooks/useFolderDocWithChildren";
import { FolderDocWithChildren } from "@/datatypes/folder";

describe("useFolderDocWithChildren", () => {
  const setup = () => {
    const repo = new Repo({
      peerId: "alice" as PeerId,
      network: [],
      storage: new DummyStorageAdapter(),
    });

    const wrapper = ({ children }) => {
      return (
        <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>
      );
    };

    return { repo, wrapper };
  };

  const makeLeafDoc = (repo: Repo) => {
    return repo.create({
      content: "this is just some doc",
    });
  };

  const Component = ({
    rootFolderUrl,
    onDoc,
  }: {
    rootFolderUrl: AutomergeUrl;
    onDoc: (arg: {
      doc: FolderDocWithChildren;
      status: "loading" | "loaded";
    }) => void;
  }) => {
    const doc = useFolderDocWithChildren(rootFolderUrl);
    onDoc(doc);
    return null;
  };

  it("returns a top level folder with no nesting", async () => {
    const { repo, wrapper } = setup();

    const leaf1 = makeLeafDoc(repo);

    const rootFolderHandle = repo.create({
      title: "Top Level Folder",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
      ],
    });

    const onDoc = vi.fn();

    render(<Component rootFolderUrl={rootFolderHandle.url} onDoc={onDoc} />, {
      wrapper,
    });
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
          ],
        },
        status: "loaded",
      })
    );
  });

  it("updates the return value when the folder changes", async () => {
    const { repo, wrapper } = setup();

    const leaf1 = makeLeafDoc(repo);
    const leaf2 = makeLeafDoc(repo);

    const rootFolderHandle = repo.create({
      title: "Top Level Folder",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
      ],
    });

    const onDoc = vi.fn();

    render(<Component rootFolderUrl={rootFolderHandle.url} onDoc={onDoc} />, {
      wrapper,
    });
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
          ],
        },
        status: "loaded",
      })
    );

    act(() => {
      rootFolderHandle.change((d) =>
        d.docs.push({
          name: "Item 2",
          type: "content",
          url: leaf2.url,
        })
      );
    });

    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loaded",
      })
    );
  });

  it("handles a folder being added in an update", async () => {
    const { repo, wrapper } = setup();

    const leaf1 = makeLeafDoc(repo);

    const rootFolderHandle = repo.create({
      title: "Top Level Folder",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
      ],
    });

    const onDoc = vi.fn();

    render(<Component rootFolderUrl={rootFolderHandle.url} onDoc={onDoc} />, {
      wrapper,
    });
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
          ],
        },
        status: "loaded",
      })
    );

    const subFolder2 = repo.create({
      title: "Sub Folder 2",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
      ],
    });

    act(() => {
      rootFolderHandle.change((d) =>
        d.docs.push({
          name: "Sub Folder 2",
          type: "folder",
          url: subFolder2.url,
        })
      );
    });

    // First we just see the link to the new folder
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
            {
              name: "Sub Folder 2",
              type: "folder",
              url: subFolder2.url,
            },
          ],
        },
        status: "loading",
      })
    );

    // Then we see its contents loaded
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Item 1",
              type: "content",
              url: leaf1.url,
            },
            {
              name: "Sub Folder 2",
              type: "folder",
              url: subFolder2.url,
              folderContents: {
                title: "Sub Folder 2",
                docs: [
                  {
                    name: "Item 1",
                    type: "content",
                    url: leaf1.url,
                  },
                ],
              },
            },
          ],
        },
        status: "loaded",
      })
    );
  });

  it("traverses down one level of nesting", async () => {
    const { repo, wrapper } = setup();

    const leaf1 = makeLeafDoc(repo);
    const leaf2 = makeLeafDoc(repo);

    const subFolderHandle = repo.create({
      title: "Sub Folder",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
      ],
    });

    const rootFolderHandle = repo.create({
      title: "Top Level Folder",
      docs: [
        {
          name: "Sub Folder",
          type: "folder",
          url: subFolderHandle.url,
        },
        {
          name: "Item 2",
          type: "content",
          url: leaf2.url,
        },
      ],
    });

    const onDoc = vi.fn();

    render(<Component rootFolderUrl={rootFolderHandle.url} onDoc={onDoc} />, {
      wrapper,
    });

    // At first, the sub folder is just a link, without contents loaded yet
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Sub Folder",
              type: "folder",
              url: subFolderHandle.url,
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loading",
      })
    );

    // Then once the sub folder loads, its contents are nested inside
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Sub Folder",
              type: "folder",
              url: subFolderHandle.url,
              folderContents: {
                title: "Sub Folder",
                docs: [
                  {
                    name: "Item 1",
                    type: "content",
                    url: leaf1.url,
                  },
                ],
              },
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loaded",
      })
    );
  });

  it("traverses down two levels of nesting", async () => {
    const { repo, wrapper } = setup();

    const leaf1 = makeLeafDoc(repo);
    const leaf2 = makeLeafDoc(repo);
    const leaf3 = makeLeafDoc(repo);

    const subsubFolderHandle = repo.create({
      title: "Sub Sub Folder",
      docs: [
        {
          name: "Item 3",
          type: "content",
          url: leaf3.url,
        },
      ],
    });

    const subFolderHandle = repo.create({
      title: "Sub Folder",
      docs: [
        {
          name: "Item 1",
          type: "content",
          url: leaf1.url,
        },
        {
          name: "Sub Sub Folder",
          type: "folder",
          url: subsubFolderHandle.url,
        },
      ],
    });

    const rootFolderHandle = repo.create({
      title: "Top Level Folder",
      docs: [
        {
          name: "Sub Folder",
          type: "folder",
          url: subFolderHandle.url,
        },
        {
          name: "Item 2",
          type: "content",
          url: leaf2.url,
        },
      ],
    });

    const onDoc = vi.fn();

    render(<Component rootFolderUrl={rootFolderHandle.url} onDoc={onDoc} />, {
      wrapper,
    });

    // At first, the sub folder is just a link, without contents loaded yet
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Sub Folder",
              type: "folder",
              url: subFolderHandle.url,
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loading",
      })
    );

    // Then once the sub folder loads, its contents are nested inside
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Sub Folder",
              type: "folder",
              url: subFolderHandle.url,
              folderContents: {
                title: "Sub Folder",
                docs: [
                  {
                    name: "Item 1",
                    type: "content",
                    url: leaf1.url,
                  },
                  {
                    name: "Sub Sub Folder",
                    type: "folder",
                    url: subsubFolderHandle.url,
                  },
                ],
              },
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loading",
      })
    );

    // Finally we load all the way down the tree
    await waitFor(() =>
      expect(onDoc).toHaveBeenCalledWith({
        doc: {
          title: "Top Level Folder",
          docs: [
            {
              name: "Sub Folder",
              type: "folder",
              url: subFolderHandle.url,
              folderContents: {
                title: "Sub Folder",
                docs: [
                  {
                    name: "Item 1",
                    type: "content",
                    url: leaf1.url,
                  },
                  {
                    name: "Sub Sub Folder",
                    type: "folder",
                    url: subsubFolderHandle.url,
                    folderContents: {
                      title: "Sub Sub Folder",
                      docs: [
                        {
                          name: "Item 3",
                          type: "content",
                          url: leaf3.url,
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              name: "Item 2",
              type: "content",
              url: leaf2.url,
            },
          ],
        },
        status: "loaded",
      })
    );
  });
});
