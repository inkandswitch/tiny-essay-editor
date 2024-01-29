import { AutomergeUrl, isValidAutomergeUrl } from "@automerge/automerge-repo";
import React, { useState } from "react";
import { ChevronsLeft, FolderInput, Plus, Text } from "lucide-react";
import { Tree, NodeRendererProps } from "react-arborist";
import { FillFlexParent } from "./FillFlexParent";
import { AccountPicker } from "./AccountPicker";

import { DocLink, useCurrentRootFolderDoc } from "../account";
import { DocType, docTypes } from "../doctypes";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Input } from "@/components/ui/input";

function Node({ node, style, dragHandle }: NodeRendererProps<DocLink>) {
  if (!docTypes[node.data.type]) {
    return <div>Unknown doc type {node.data.type}</div>;
  }
  const Icon = docTypes[node.data.type]?.icon;

  return (
    <div
      style={style}
      ref={dragHandle}
      className={`cursor-pointer text-sm py-1 w-full truncate ${
        node.isSelected
          ? " bg-gray-300 hover:bg-gray-300 text-gray-900"
          : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      <Icon
        size={12}
        className={`${
          node.isSelected ? "text-gray-800" : "text-gray-500"
        } inline-block align-top mt-[3px] ml-2 mx-2`}
      />
      {node.data.name}
    </div>
  );
}

type SidebarProps = {
  selectedDocUrl: AutomergeUrl | null;
  selectDoc: (docUrl: AutomergeUrl | null) => void;
  hideSidebar: () => void;
  addNewDocument: (doc: { type: DocType }) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
  selectedDocUrl,
  selectDoc,
  hideSidebar,
  addNewDocument,
}) => {
  const [rootFolderDoc, changeRootFolderDoc] = useCurrentRootFolderDoc();

  // state related to open popover
  const [openNewDocPopoverVisible, setOpenNewDocPopoverVisible] =
    useState(false);
  const [openUrlInput, setOpenUrlInput] = useState("");
  const automergeUrlMatch = openUrlInput.match(/(automerge:[a-zA-Z0-9]*)/);
  const automergeUrlToOpen =
    automergeUrlMatch &&
    automergeUrlMatch[1] &&
    isValidAutomergeUrl(automergeUrlMatch[1])
      ? automergeUrlMatch[1]
      : null;

  if (!rootFolderDoc) {
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
                data={rootFolderDoc.docs}
                width={width}
                height={height}
                rowHeight={28}
                selection={selectedDocUrl}
                idAccessor={(item) => item.url}
                onSelect={(selections) => {
                  if (!selections) {
                    return false;
                  }
                  if (isValidAutomergeUrl(selections[0]?.id)) {
                    selectDoc(selections[0].id as AutomergeUrl);
                  }
                }}
                // For now, don't allow deleting w/ backspace key in the sidebar—
                // it's too unsafe without undo.
                // onDelete={({ ids }) => {
                //   for (const id of ids) {
                //     deleteFromAccountDocList(id as AutomergeUrl);
                //   }
                // }}
                onMove={({ dragIds, parentId, index: dragTargetIndex }) => {
                  if (parentId !== null) {
                    // shouldn't get here since we don't do directories yet
                    return;
                  }

                  for (const dragId of dragIds) {
                    const dragItemIndex = rootFolderDoc.docs.findIndex(
                      (item) => item.url === dragId
                    );
                    if (dragItemIndex !== undefined) {
                      // TODO: is this the right way to do an array move in automerge?
                      // Pretty sure it is, since there's no array move operation?
                      const copiedItem = JSON.parse(
                        JSON.stringify(rootFolderDoc.docs[dragItemIndex])
                      );

                      // If we're dragging to the right of the array, we need to account for
                      // the fact that the array will be shorter after we remove the original element
                      const adjustedTargetIndex =
                        dragItemIndex < dragTargetIndex
                          ? dragTargetIndex - 1
                          : dragTargetIndex;
                      changeRootFolderDoc((doc) => {
                        doc.docs.splice(dragItemIndex, 1);
                        doc.docs.splice(adjustedTargetIndex, 0, copiedItem);
                      });
                    }
                  }
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
