import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  FileQuestionIcon,
  FolderInput,
} from "lucide-react";
import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NodeRendererProps, Tree } from "react-arborist";
import { AccountPicker } from "./AccountPicker";
import { FillFlexParent } from "./FillFlexParent";

import {
  DocLink,
  DocLinkWithFolderPath,
  FolderDoc,
  FolderDocWithChildren,
} from "@/packages/folder";
import { DatatypeId, useDataType, useDataTypes } from "../../datatypes";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Input } from "@/components/ui/input";
import { FolderDocWithMetadata } from "@/packages/folder/hooks/useFolderDocWithChildren";
import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import { useDocument, useRepo } from "@automerge/automerge-repo-react-hooks";
import { structuredClone } from "@tldraw/tldraw";
import { capitalize, uniqBy } from "lodash";
import {
  UIStateDoc,
  useCurrentAccountDoc,
  useDatatypeSettings,
} from "../account";

const Node = (props: NodeRendererProps<DocLinkWithFolderPath>) => {
  const { node, style, dragHandle } = props;
  const dataType = useDataType(node.data.type);
  let Icon;

  if (node.data.type === "folder") {
    if (node.isOpen) {
      Icon = ChevronDown;
    } else {
      Icon = ChevronRight;
    }
  } else {
    Icon = dataType?.icon ?? FileQuestionIcon;
  }

  return (
    <div
      style={style}
      ref={dragHandle}
      className={`flex items-center cursor-pointer text-sm py-1 w-full truncate ${
        node.isSelected
          ? " bg-gray-300 hover:bg-gray-300 text-gray-900"
          : "text-gray-600 hover:bg-gray-200"
      }`}
      onDoubleClick={() => node.edit()}
    >
      <div
        className={`${node.isSelected ? "text-gray-800" : "text-gray-500"} ${
          node.data.type === "folder" && "hover:bg-gray-400 text-gray-800"
        } p-1 mr-0.5 rounded-sm transition-all`}
        onClick={() => {
          if (node.data.type === "folder") {
            node.toggle();
          }
        }}
      >
        <Icon size={14} />
      </div>

      {!node.isEditing && (
        <>
          <div>
            {dataType ? dataType.name : `Unknown type: ${node.data.type}`}
          </div>
          {node.data.type === "folder" && (
            <div className="ml-2 text-gray-500 text-xs py-0.5 px-1.5 rounded-lg bg-gray-200">
              {node.children.length}
            </div>
          )}
        </>
      )}
      {node.isEditing && <Edit {...props} />}
    </div>
  );
};

const Edit = ({ node }: NodeRendererProps<DocLink>) => {
  const input = useRef<any>();

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <input
      ref={input}
      defaultValue={node.data.name}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        if (e.key === "Escape") node.reset();
        if (e.key === "Enter") node.submit(input.current?.value || "");
      }}
    ></input>
  );
};

type SidebarProps = {
  rootFolderDoc: FolderDocWithMetadata;
  selectedDocLink: DocLinkWithFolderPath | null;
  selectDocLink: (docLink: DocLinkWithFolderPath | null) => void;
  hideSidebar: () => void;
  addNewDocument: (doc: { type: DatatypeId }) => void;
};

const prepareDataForTree = (
  folderDoc: FolderDocWithChildren,
  folderPath: AutomergeUrl[]
) => {
  if (!folderDoc) {
    return [];
  }
  return uniqBy(folderDoc.docs, "url").map((docLink) => ({
    ...docLink,
    folderPath,
    children:
      docLink.type === "folder" && docLink.folderContents
        ? prepareDataForTree(docLink.folderContents, [
            ...folderPath,
            docLink.url,
          ])
        : undefined,
  }));
};

const idAccessor = (item: DocLinkWithFolderPath) => {
  return JSON.stringify({
    url: item.url,
    folderPath: item.folderPath,
  });
};

export const Sidebar: React.FC<SidebarProps> = ({
  selectedDocLink,
  selectDocLink,
  hideSidebar,
  addNewDocument,
  rootFolderDoc,
}) => {
  const repo = useRepo();
  const dataTypes = useDataTypes();
  const {
    doc: rootFolderDocWithChildren,
    status,
    rootFolderUrl,
    flatDocLinks,
  } = rootFolderDoc;

  const datatypeSettings = useDatatypeSettings();

  // state related to open popover
  const [openNewDocPopoverVisible, setOpenNewDocPopoverVisible] =
    useState(false);
  const [openUrlInput, setOpenUrlInput] = useState("");
  const automergeUrlMatch = openUrlInput
    .replace(/%3A/g, ":")
    .match(/(automerge:[a-zA-Z0-9]*)/);
  const automergeUrlToOpen =
    automergeUrlMatch &&
    automergeUrlMatch[1] &&
    isValidAutomergeUrl(automergeUrlMatch[1])
      ? automergeUrlMatch[1]
      : null;

  const [searchQuery, setSearchQuery] = useState("");

  const [accountDoc] = useCurrentAccountDoc();

  const [uiStateDoc, changeUIStateDoc] = useDocument<UIStateDoc>(
    accountDoc?.uiStateUrl
  );

  const onMove = ({ parentNode, index: dragTargetIndex, dragNodes }) => {
    for (const dragNode of dragNodes) {
      const currentParentUrl =
        dragNode.parent.level < 0
          ? rootFolderUrl
          : (dragNode.parent.data.url as AutomergeUrl);
      const currentParentHandle = repo.find<FolderDoc>(currentParentUrl);
      const dragItemIndex = currentParentHandle
        .docSync()
        .docs.findIndex((item) => item.url === dragNode.data.url);

      const newParentUrl =
        !parentNode || parentNode.level < 0
          ? rootFolderUrl
          : (parentNode.data.url as AutomergeUrl);
      const newParentHandle = repo.find<FolderDoc>(newParentUrl);

      if (dragItemIndex === undefined) {
        return;
      }

      // If we're dragging later within the same folder, we need to account for
      // the fact that the array will be shorter after we remove the original element
      const adjustedTargetIndex =
        currentParentUrl === newParentUrl && dragItemIndex < dragTargetIndex
          ? dragTargetIndex - 1
          : dragTargetIndex;

      let removedItem;
      currentParentHandle.change((d) => {
        const spliceResult = d.docs.splice(dragItemIndex, 1);
        removedItem = structuredClone({ ...spliceResult[0] });
      });

      newParentHandle.change((d) => {
        d.docs.splice(adjustedTargetIndex, 0, removedItem);
      });
    }
  };

  const dataForTree = prepareDataForTree(rootFolderDocWithChildren, [
    rootFolderUrl,
  ]);

  const treeSelection = selectedDocLink ? idAccessor(selectedDocLink) : null;

  const onRename = ({ node, name }) => {
    const docLink = flatDocLinks.find((doc) => doc.url === node.data.url);
    const dataType = dataTypes[docLink.type];

    if (!dataType.setTitle) {
      alert(
        `${capitalize(
          dataType.name
        )} documents can only be renamed in the main editor, not the sidebar.`
      );
      return;
    }

    if (!docLink) {
      return;
    }
    const parentHandle = repo.find<FolderDoc>(
      docLink.folderPath[docLink.folderPath.length - 1]
    );

    // rename doc link
    parentHandle.change((d) => {
      const doc = d.docs.find((doc) => doc.url === docLink.url);
      if (doc) {
        doc.name = name;
      }
    });

    // rename doc title
    const docHandle = repo.find<HasVersionControlMetadata<unknown, unknown>>(
      docLink.url
    );
    docHandle.change((doc) => {
      dataType.setTitle(doc, name);
    });

    selectDocLink({ ...selectedDocLink, name });
  };

  const onToggle = (id: string) => {
    const link = JSON.parse(id);
    changeUIStateDoc((uiState) => {
      if (
        uiState.openedFoldersInSidebar.find((folder) => folder.url === link.url)
      ) {
        const index = uiState.openedFoldersInSidebar.findIndex(
          (folder) => folder.url === link.url
        );
        if (index !== -1) {
          uiState.openedFoldersInSidebar.splice(index, 1);
        }
      } else {
        uiState.openedFoldersInSidebar.push(link);
      }
    });
  };

  const initialOpenState = useMemo(
    () =>
      (uiStateDoc?.openedFoldersInSidebar ?? []).reduce((acc, key) => {
        acc[
          // This is gross: we need to make sure that JSON stringify does the keys in the right order...
          JSON.stringify({
            url: key.url,
            folderPath: key.folderPath,
          })
        ] = true;
        return acc;
      }, {}),
    [uiStateDoc]
  );

  // Show a loading spinner until we've recursively loaded all folder contents
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="h-10 py-2 px-4 font-semibold text-gray-500 text-sm flex">
        <div className="mw-40 mt-[3px]">My Documents</div>
        <div className="ml-auto">
          <div
            className="text-gray-400 hover:bg-gray-300 hover:text-gray-500 cursor-pointer  transition-all p-1 m-[-4px] mr-[-8px] rounded-sm"
            onClick={hideSidebar}
          >
            <ChevronsLeft />
          </div>
        </div>
      </div>
      <div className="py-2  border-b border-gray-200">
        {Object.values(dataTypes).map((dataType) => {
          const { id } = dataType;
          const isEnabled = datatypeSettings?.enabledDatatypeIds[id];
          if (
            isEnabled == false ||
            (isEnabled !== true && dataType.isExperimental)
          ) {
            return;
          }

          return (
            <div key={dataType.id}>
              {" "}
              <div
                className="py-1 px-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-200 "
                onClick={() => addNewDocument({ type: id as DatatypeId })}
              >
                <dataType.icon
                  size={14}
                  className="inline-block font-bold mr-2 align-top mt-[2px]"
                />
                New {dataType.name}
              </div>
            </div>
          );
        })}

        <div
          className="py-1 px-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-200 "
          onClick={() => setOpenNewDocPopoverVisible(true)}
        >
          {/* todo: extract a component for this */}
          <Popover
            open={openNewDocPopoverVisible}
            onOpenChange={setOpenNewDocPopoverVisible}
          >
            <PopoverTrigger>
              <FolderInput
                size={14}
                className="inline-block font-bold mr-2 align-top mt-[2px]"
              />
              Open document
            </PopoverTrigger>
            <PopoverContent className="w-96 h-20" side="right">
              <Input
                value={openUrlInput}
                placeholder="automerge:<url>"
                onChange={(e) => setOpenUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && automergeUrlToOpen) {
                    // openDocFromUrl(automergeUrlToOpen); // TODO FIX THIS
                    setOpenUrlInput("");
                    setOpenNewDocPopoverVisible(false);
                  }
                }}
                className={`outline-none ${
                  automergeUrlToOpen
                    ? "bg-green-100"
                    : openUrlInput.length > 0
                    ? "bg-red-100"
                    : ""
                }`}
              />
              <div className="text-xs text-gray-500 text-right mt-1">
                {automergeUrlToOpen && <> {"\u23CE"} Enter to open </>}
                {openUrlInput.length > 0 &&
                  !automergeUrlToOpen &&
                  "Not a valid Automerge URL"}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mx-2 my-2 flex gap-2 items-center">
        <Input
          placeholder="Search my docs..."
          className="h-6"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div
          className={`text-gray-400 text-xs cursor-pointer ${
            searchQuery.length > 0 ? "" : "invisible"
          }`}
          onClick={() => setSearchQuery("")}
        >
          Clear
        </div>
      </div>

      <div className="flex-grow overflow-auto">
        <FillFlexParent>
          {({ width, height }) => {
            return (
              <Tree
                data={dataForTree}
                width={width}
                height={height}
                openByDefault={false}
                searchTerm={searchQuery}
                rowHeight={28}
                selection={treeSelection}
                idAccessor={idAccessor}
                onSelect={(selections) => {
                  if (
                    !selections ||
                    selections.length === 0 ||
                    // ignore on select if the selection hasn't changed
                    // this can happens when the tree component is being initialized
                    selections[0].id === treeSelection
                  ) {
                    return false;
                  }
                  const newlySelectedDocLink = selections[0].data;
                  if (isValidAutomergeUrl(newlySelectedDocLink.url)) {
                    selectDocLink(newlySelectedDocLink);
                  }
                }}
                // For now, don't allow deleting w/ backspace key in the sidebar—
                // it's too unsafe without undo.
                // onDelete={({ ids }) => {
                //   for (const id of ids) {
                //     deleteFromAccountDocList(id as AutomergeUrl);
                //   }
                // }}
                onMove={onMove}
                // Notably toggle state is "uncontrolled" state that the component manages privately --
                // after initial mount, the component stores in-memory state privately, and we also
                // send all updates to automerge in order to rehydrate on next page load or next mount.
                // That seems fine for this state where it's not a huge problem if the component desyncs
                // from the automerge doc.
                initialOpenState={initialOpenState}
                onToggle={onToggle}
                onRename={onRename}
              >
                {Node}
              </Tree>
            );
          }}
        </FillFlexParent>
      </div>

      <div className="h-12 border-t border-gray-300 py-1 px-2 bg-gray-200">
        <AccountPicker showName />
      </div>
    </div>
  );
};
