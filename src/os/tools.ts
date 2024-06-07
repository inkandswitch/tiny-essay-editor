import * as A from "@automerge/automerge/next";
import React from "react";
import essay from "@/tools/essay";
import tldraw from "@/tools/tldraw";
import folder from "@/tools/folder";
import datagrid from "@/tools/datagrid";
import bot from "@/tools/bot";
import kanban from "@/tools/kanban";
import richessay from "@/tools/richessay";

import { AutomergeUrl } from "@automerge/automerge-repo";
import {
  Annotation,
  AnnotationGroupWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { AnnotationWithUIState } from "@/os/versionControl/schema";
import { DatatypeId } from "./datatypes";
import { DocHandle } from "@automerge/automerge-repo";

export type Tool = {
  id: DatatypeId;
  name: string;
  editorComponent: React.FC<EditorProps<unknown, unknown>>;
  annotationViewComponent?: React.FC<
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

const getToolsMap = (tools: Tool[]): Record<string, Tool[]> => {
  const map = {};

  tools.forEach((tool) => {
    if (!map[tool.id]) {
      map[tool.id] = [tool];
    } else {
      map[tool.id].push(tools);
    }
  });

  return map;
};

export const TOOLS = getToolsMap([
  essay,
  richessay,
  tldraw,
  folder,
  datagrid,
  bot,
  kanban,
]);
