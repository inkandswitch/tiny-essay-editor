import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useEffect, useRef, useState } from "react";
import { ChevronsLeft, FileQuestionIcon, FolderInput } from "lucide-react";
import { Tree, NodeRendererProps } from "react-arborist";
import { FillFlexParent } from "./FillFlexParent";
import { AccountPicker } from "./AccountPicker";

import {
  DocLink,
  DocLinkWithFolderPath,
  FolderDoc,
  FolderDocWithChildren,
} from "@/folders/datatype";
import { DocType, docTypes } from "../doctypes";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Input } from "@/components/ui/input";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { structuredClone } from "@tldraw/tldraw";
import { FolderDocWithMetadata } from "@/folders/useFolderDocWithChildren";
import { capitalize } from "lodash";

const Node = (props: NodeRendererProps<DocLinkWithFolderPath>) => {
  const { node, style, dragHandle } = props;
  const Icon = docTypes[node.data.type]?.icon ?? FileQuestionIcon;

  return (
    <div
      style={style}
      ref={dragHandle}
      className={`cursor-pointer text-sm py-1 w-full truncate ${
        node.isSelected
          ? " bg-gray-300 hover:bg-gray-300 text-gray-900"
          : "text-gray-600 hover:bg-gray-200"
      }`}
      onDoubleClick={() => node.edit()}
    >
      <Icon
        size={14}
        className={`${
          node.isSelected ? "text-gray-800" : "text-gray-500"
        } inline-block align-top mt-[3px] ml-2 mx-2`}
      />
      {!node.isEditing && (
        <span>
          {docTypes[node.data.type]
            ? node.data.name
            : `Unknown type: ${node.data.type}`}
        </span>
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
  addNewDocument: (doc: { type: DocType }) => void;
};

const prepareDataForTree = (
  folderDoc: FolderDocWithChildren,
  folderPath: AutomergeUrl[]
) => {
  if (!folderDoc) {
    return [];
  }
  return folderDoc.docs.map((docLink) => ({
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
  const {
    doc: rootFolderDocWithChildren,
    status,
    rootFolderUrl,
    flatDocLinks,
  } = rootFolderDoc;

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

  // Show a loading spinner until we've recursively loaded all folder contents
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

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
        {Object.entries(docTypes).map(([id, docType]) => (
          <div key={docType.id}>
            {" "}
            <div
              className="py-1 px-2 text-sm text-gray-600 cursor-pointer hover:bg-gray-200 "
              onClick={() => addNewDocument({ type: id as DocType })}
            >
              <docType.icon
                size={14}
                className="inline-block font-bold mr-2 align-top mt-[2px]"
              />
              New {docType.name}
            </div>
          </div>
        ))}

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

      <div className="flex-grow overflow-auto">
        <FillFlexParent>
          {({ width, height }) => {
            return (
              <Tree
                data={dataForTree}
                width={width}
                height={height}
                rowHeight={28}
                selection={treeSelection}
                idAccessor={idAccessor}
                onSelect={(selections) => {
                  if (!selections || selections.length === 0) {
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
                onRename={({ node, name }) => {
                  const docLink = flatDocLinks.find(
                    (doc) => doc.url === node.data.url
                  );
                  const datatype = docTypes[docLink.type];

                  if (!datatype.setTitle) {
                    alert(
                      `${capitalize(
                        datatype.name
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
                  parentHandle.change((d) => {
                    const doc = d.docs.find((doc) => doc.url === docLink.url);
                    if (doc) {
                      doc.name = name;
                    }
                  });
                }}
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
