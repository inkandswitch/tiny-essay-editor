import * as A from "@automerge/automerge/next";
import React, { useMemo, useRef, useState } from "react";

import {
  Annotation,
  AnnotationGroupWithUIState,
  AnnotationWithUIState,
  CommentState,
  HasVersionControlMetadata,
} from "@/os/versionControl/schema";
import { DocLink } from "@/packages/folder";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { useRepo } from "@automerge/automerge-repo-react-hooks";
import { DataType } from "./datatypes";
import { useRootFolderDocWithChildren } from "./explorer/account";
import { PACKAGES } from "@/packages";

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

const isTool = (value: any): value is Tool => {
  return "type" in value && value.type === "patchwork:tool";
};

const TOOLS: ToolWithId[] = [];

for (const [path, module] of Object.entries(PACKAGES)) {
  const id = path.split("/")[1];

  for (const [key, value] of Object.entries(module)) {
    if (isTool(value)) {
      TOOLS.push({ ...value, id: `${id}/${key}` });
    }
  }
}

console.log({ TOOLS });

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
