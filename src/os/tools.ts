import * as A from "@automerge/automerge/next";
import React, { useEffect, useMemo, useState } from "react";

import {
  Annotation,
  AnnotationGroupWithUIState,
  AnnotationWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { usePackageModulesInRootFolder } from "@/packages/pkg/usePackages";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { DataType } from "./datatypes";
import { IconType } from "./lib/icons";

export type Tool = {
  id: string;
  type: "patchwork:tool";
  supportedDataTypes: "*" | DataType<unknown, unknown, unknown>[];
  name: string;
  icon?: IconType;
  editorComponent: React.FC<EditorProps<unknown, unknown>>;
  annotationsViewComponent?: React.FC<
    AnnotationsViewProps<
      HasVersionControlMetadata<unknown, unknown>,
      unknown,
      unknown
    >
  >;
  /** whether this tool has support for rendering comments inline or if it
   * relies exclusively on the review sidebar to show comments */
  supportsInlineComments?: boolean;
};

export type EditorProps<T, V> = {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  activeDiscussionIds?: string[];
  annotations?: AnnotationWithUIState<T, V>[];
  annotationGroups?: AnnotationGroupWithUIState<T, V>[];
  actorIdToAuthor?: Record<A.ActorId, AutomergeUrl>; // todo: can we replace that with memoize?

  setSelectedAnchors?: (anchors: T[]) => void;
  setHoveredAnchor?: (anchors: T) => void;
  setSelectedAnnotationGroupId?: (groupId: string) => void;
  setHoveredAnnotationGroupId?: (groupId: string) => void;
  setCommentState?: (state: CommentState<T>) => void;

  hideInlineComments?: boolean;
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

const isTool = (value: any): value is Tool => {
  return "type" in value && value.type === "patchwork:tool";
};

export const useTools = (): Tool[] => {
  const [builtInTools, setBuiltInTools] = useState<Tool[]>([]);
  const [dynamicTools, setDynamicTools] = useState<Tool[]>([]);
  const modules = usePackageModulesInRootFolder();

  // add exported tools in packages to tools
  useEffect(() => {
    setDynamicTools(
      Object.values(modules).flatMap((module) =>
        Object.values(module).filter(isTool)
      )
    );
  }, [modules]);

  // load packages asynchronously to break the dependency loop tools -> packages -> tools
  useEffect(() => {
    import("@/packages").then((packages) => {
      setBuiltInTools(
        Object.values(packages).flatMap((module) =>
          Object.values(module).filter(isTool)
        )
      );
    });
  }, []);

  return builtInTools.concat(dynamicTools);
};

export const useToolsForDataType = (
  dataType: DataType<unknown, unknown, unknown> | string
): Tool[] => {
  const tools = useTools();

  return useMemo(() => {
    return tools.filter((tool) => {
      return (
        tool.supportedDataTypes === "*" ||
        (typeof dataType === "string"
          ? tool.supportedDataTypes.some((d) => d.id === dataType)
          : tool.supportedDataTypes.includes(dataType))
      );
    });
  }, [tools, dataType]);
};

export const useTool = (id: string): Tool => {
  const tools = useTools();
  return tools.find((tool) => tool.id === id);
};
