import { next as A } from "@automerge/automerge";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { TLDrawDatatype } from "@/tldraw/datatype";
import { DataGridDatatype } from "@/datagrid/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { EssayEditingBotDatatype } from "@/bots/datatype";
import { Repo } from "@automerge/automerge-repo";
import { DecodedChangeWithMetadata } from "@/patchwork/groupChanges";
import { HasPatchworkMetadata } from "@/patchwork/schema";
import { TextPatch } from "@/patchwork/utils";
import { Annotation, AnnotationPosition } from "@/patchwork/schema";
import { KanbanBoardDatatype } from "@/kanban/datatype";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { BotEditor } from "@/bots/BotEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";
import { DataGrid } from "@/datagrid/components/DataGrid";
import { KanbanBoard } from "@/kanban/components/Kanban";
import { DocEditorPropsWithDocType } from "@/patchwork/components/PatchworkDocEditor";

export type CoreDataType<D, T, V> = {
  id: string;
  name: string;
  icon: any;
  init: (doc: D, repo: Repo) => void;
  getTitle: (doc: D, repo: Repo) => Promise<string>;
  markCopy: (doc: D) => void; // TODO: this shouldn't be part of the interface
  methods?: Record<string, (handle: DocHandle<D>, ...args: unknown[]) => void>;
};

export type PatchworkDataType<D, T, V> = {
  // TODO (GL 3/12/24): we'd like to unify these two filter methods
  // and possibly combine them with grouping logic soon.

  // Mark whether a given change should be included in the history
  includeChangeInHistory?: (
    doc: D,
    change: DecodedChangeWithMetadata
  ) => boolean;
  // Mark whether a given patch should be included in the history
  includePatchInChangeGroup?: (patch: A.Patch | TextPatch) => boolean; // todo: can we get rid of TextPatch here?

  /* Generate a prompt for an LLM to summarize a diff */
  promptForAutoChangeGroupDescription?: (args: {
    docBefore: D;
    docAfter: D;
  }) => string;

  /* Turn a list of patches into annotations to display in the UI */
  patchesToAnnotations?: (
    doc: D,
    docBefore: D,
    patches: A.Patch[]
  ) => Annotation<T, V>[];
};

export type DataType<D, T, V> = CoreDataType<D, T, V> &
  PatchworkDataType<D, T, V>;

export const docTypes: Record<
  string,
  DataType<HasPatchworkMetadata<unknown, unknown>, unknown, unknown>
> = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
  datagrid: DataGridDatatype,
  bot: EssayEditingBotDatatype,
  kanban: KanbanBoardDatatype,
} as const;

export type DocType = keyof typeof docTypes;

// Store a list of tools that can be used with each doc type.
// This is a crude stand-in for a more flexible system based on matching
// data schemas with tool capabilities.
// It's important to store this mapping outside of the datatypes themselves;
// there might be tools a datatype doesn't know about which can edit the datatype.
// (A simple example is a raw JSON editor.)
export const toolsForDocTypes: Record<
  string,
  Array<React.FC<DocEditorPropsWithDocType<any, any>>>
> = {
  essay: [TinyEssayEditor],
  bot: [BotEditor],
  tldraw: [TLDraw],
  datagrid: [DataGrid],
  kanban: [KanbanBoard],
};

export interface DocEditorProps<T, V> {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  activeDiscussionIds?: string[];
  annotations?: Annotation<T, V>[];
  actorIdToAuthor?: Record<A.ActorId, AutomergeUrl>; // todo: can we replace that with memoize?

  // spatial comments interface
  // todo: simplify
  selectedAnnotations?: Annotation<T, V>;
  hoveredAnnotation?: Annotation<T, V>;
  setHoveredAnnotation?: (annotation: Annotation<T, V>) => void;
  setSelectedAnnotations?: (annotations: Annotation<T, V>[]) => void;
  onUpdateAnnotationPositions?: (positions: AnnotationPosition<T, V>[]) => void;
}
