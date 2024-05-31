import * as A from "@automerge/automerge/next";
import React, { useMemo } from "react";

import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  Annotation,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { AnnotationWithUIState } from "@/os/versionControl/schema";
import { DocHandle } from "@automerge/automerge-repo";
import { Module } from "./modules";

export type ToolMetaData = {
  id: string;
  supportedDatatypes: string[];
  name: string;
};

export type Tool = {
  editorComponent: React.FC<EditorProps<unknown, unknown>>;
  annotationViewComponent?: React.FC<
    AnnotationsViewProps<
      HasVersionControlMetadata<unknown, unknown>,
      unknown,
      unknown
    >
  >;
};

export type EditorProps<T, V> = {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  activeDiscussionIds?: string[];
  annotations?: AnnotationWithUIState<T, V>[];
  actorIdToAuthor?: Record<A.ActorId, AutomergeUrl>; // todo: can we replace that with memoize?

  setSelectedAnchors?: (anchors: T[]) => void;
  setHoveredAnchor?: (anchors: T) => void;
};

export type AnnotationsViewProps<
  D extends HasVersionControlMetadata<T, V>,
  T,
  V
> = {
  doc: D;
  handle: DocHandle<D>;
  annotations: Annotation<T, V>[];
};

const TOOLS: Module<ToolMetaData, Tool>[] = [];

const toolsFolder: Record<string, { default: Module<ToolMetaData, Tool> }> =
  import.meta.glob("../tools/*/module.@(ts|js|tsx|jsx)", {
    eager: true,
  });

for (const [path, { default: module }] of Object.entries(toolsFolder)) {
  const id = path.split("/")[2];

  if (id !== module.metadata.id) {
    throw new Error(
      `Can't load tool: id "${module.metadata.id}" does not match the folder name "${id}"`
    );
  }

  TOOLS.push(module);
}

export const useToolModules = () => {
  return TOOLS;
};

export const useToolModulesForDataType = (dataTypeId: string) => {
  const tools = useToolModules();

  return useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.metadata.supportedDatatypes.includes(dataTypeId) ||
          tool.metadata.supportedDatatypes.includes("*")
      ),
    [tools, dataTypeId]
  );
};
