import * as A from "@automerge/automerge/next";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Annotation,
  AnnotationWithUIState,
  AnnotationGroupWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import {
  AutomergeUrl,
  DocHandle,
  parseAutomergeUrl,
} from "@automerge/automerge-repo";
import { useRootFolderDocWithChildren } from "./explorer/account";
import { DocLink } from "@/packages/folder";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { DataType } from "./datatypes";

export type Tool = {
  type: "patchwork:tool";
  supportedDatatypes: (DataType<unknown, unknown, unknown> | "*")[];
  name: string;
  icon?: any;
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

export type ToolWithId = Tool & { id: string };

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

// todo: remove export and use hook instead everywhere
export const TOOLS: ToolWithId[] = [];

/* const toolsFolder: Record<string, { default: Module<ToolMetaData, Tool> }> =
 
for (const [path, { default: module }] of Object.entries(toolsFolder)) {
  const id = path.split("/")[2];

  if (id !== module.metadata.id) {
    throw new Error(
      `Can't load tool: id "${module.metadata.id}" does not match the folder name "${id}"`
    );
  }

  TOOLS.push(module);
}*/

export const useTools = (): ToolWithId[] => {
  const [dynamicModules, setDynamicModules] = useState([]);
  const repo = useRepo();

  const { flatDocLinks } = useRootFolderDocWithChildren();

  const moduleDocLinks = useMemo(
    () =>
      flatDocLinks ? flatDocLinks.filter((link) => link.type === "module") : [],
    [flatDocLinks]
  );

  const moduleDocLinksRef = useRef<DocLink[]>();
  moduleDocLinksRef.current = moduleDocLinks;

  // todo: adapt
  /* useEffect(() => {
    Promise.all(
      moduleDocLinks.map(async ({ url }) => {
        const moduleDoc = await repo.find<ModuleDoc>(url).doc();
        console.log(url, moduleDoc);
        const { source } = moduleDoc;
        console.log("load", source);

        const docId = parseAutomergeUrl(url).documentId;

        const sourceUrl =
          source.type === "url"
            ? source.url
            : `https://automerge/${docId}/source/index.js`;

        console.log(sourceUrl);

        const module = await import(sourceUrl);
        return module.default;
      })
    ).then((modules) => {
      // skip if moduleDocLinks has changed in the meantime
      if (moduleDocLinks !== moduleDocLinksRef.current) {
        return;
      }

      setDynamicModules(modules);
    });
  }, [moduleDocLinks, repo]); */

  return TOOLS.concat(dynamicModules);
};

export const useToolsForDataType = (
  dataType: DataType<unknown, unknown, unknown>
): ToolWithId[] => {
  const tools = useTools();

  return useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.supportedDatatypes.includes(dataType) ||
          tool.supportedDatatypes.includes("*")
      ),
    [tools, dataType]
  );
};

export const useTool = (id: string): ToolWithId => {
  const tools = useTools();
  return tools.find((tool) => tool.id === id);
};
