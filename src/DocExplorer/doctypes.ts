import { next as A, Doc } from "@automerge/automerge";
import { AutomergeUrl, DocHandle } from "@automerge/automerge-repo";
import { TLDrawDatatype } from "@/tldraw/datatype";
import { DataGridDatatype } from "@/datagrid/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { EssayEditingBotDatatype } from "@/bots/datatype";
import { Repo } from "@automerge/automerge-repo";
import {
  ChangeGroup,
  DecodedChangeWithMetadata,
} from "@/patchwork/groupChanges";
import { AnnotationWithState, HasPatchworkMetadata } from "@/patchwork/schema";
import { TextPatch } from "@/patchwork/utils";
import { Annotation } from "@/patchwork/schema";
import { KanbanBoardDatatype } from "@/kanban/datatype";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { BotEditor } from "@/bots/BotEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";
import { DataGrid } from "@/datagrid/components/DataGrid";
import { KanbanBoard } from "@/kanban/components/Kanban";
import { DocEditorPropsWithDocType } from "@/patchwork/components/PatchworkDocEditor";
import { TLDrawAnnotations } from "@/tldraw/components/TLDrawAnnotations";
import { EssayAnnotations } from "@/tee/components/EssayAnnotations";

export type CoreDataType<D> = {
  id: string;
  name: string;
  icon: any;
  init: (doc: D, repo: Repo) => void;
  getTitle: (doc: D, repo: Repo) => Promise<string>;
  markCopy: (doc: D) => void; // TODO: this shouldn't be part of the interface
  actions?: Record<string, (doc: Doc<D>, args: object) => void>;
};

export type PatchworkDataType<D, T, V> = {
  // TODO (GL 3/12/24): we'd like to unify these two filter methods
  // and possibly combine them with grouping logic soon.

  // Mark whether a given change should be included in the history.
  // Note: This function has a strange signature that takes in a doc and a change
  // independently in a curried way. This is because we want to do doc-global
  // stuff just once up front for performance, and then reuse when checking each change.
  // (See the implementation for Markdown docs as one example.)
  // If Automerge had more ergonomic APIs for observing what ops did, this wouldn't be needed.
  includeChangeInHistory?: (
    doc: D
  ) => (change: DecodedChangeWithMetadata) => boolean;

  // Mark whether a given patch should be included in the history
  includePatchInChangeGroup?: (patch: A.Patch | TextPatch) => boolean; // todo: can we get rid of TextPatch here?

  /** A datatype can define two ways of summarizing a change group.
   *  - The first is a "fallback summary": computed deterministically based on the group contents,
   *  and intended to be a cheap default summary.
   *  - The second is a prompt for an AI summary. This lets an LLM (expensively) compute a string
   *  that summarizes the contents of the change group.
   *
   *  Both are optional.
   * - If a fallback summary isn't provided, Patchwork will fill in a generic summary.
   * - If the AI prompt isn't provided, AI summarization won't run for this datatype.
   */

  /* Generate a summary of a change group based on its contents */
  fallbackSummaryForChangeGroup?: (changeGroup: ChangeGroup<D>) => string;

  /* Generate a prompt for an LLM to summarize a change group */
  promptForAIChangeGroupSummary?: (args: {
    docBefore: D;
    docAfter: D;
  }) => string;

  /* Turn a list of patches into annotations to display in the UI */
  patchesToAnnotations?: (
    doc: D,
    docBefore: D,
    patches: A.Patch[]
  ) => Annotation<T, V>[];

  /* Group annotations into logical units. This function get's passed all annotations
   * that are not associated with any discussions
   *
   * The sort order is not preserved. For sorting implement the sortAnchorsBy method.
   */
  groupAnnotations?: (annotations: Annotation<T, V>[]) => Annotation<T, V>[][];

  /* Resolves to the value the anchor is pointing to in a document.
   * If the anchor cannot be resolved return undefined */
  valueOfAnchor: (doc: D, anchor: T) => V | undefined;

  /* Checks if two anchors overlap. This is used to associate edit annotations with
   * discussions. A discussion grabs any annotations that overlap with the anchors
   * associated with the discussion
   *
   * If this method is not implemented deep equal will be used as a fallback
   */
  doAnchorsOverlap?: (anchor1: T, anchor2: T, doc: D) => boolean;

  /** Defines a value for each anchor that will be use to sort them by in descending order.
   *  This is used for example in the SpatialSidebar to sort the annotation group.
   *
   *  If this method is not implemented the anchors will not be sorted.
   */
  sortAnchorsBy?: (doc: D, anchor: T) => any;
};

export type DataType<D, T, V> = CoreDataType<D> & PatchworkDataType<D, T, V>;

// TODO: we can narrow the types below by constructing a mapping from docType IDs
// to the corresponding typescript type. This will be more natural once we have a
// schema system for generating typescript types.

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
// data schemas with editor capabilities.
// It's important to store this mapping outside of the datatypes themselves;
// there might be tools a datatype doesn't know about which can edit the datatype.
// (A simple example is a raw JSON editor.)
export const editorsForDocType: Record<
  string,
  Array<React.FC<DocEditorPropsWithDocType<any, any>>>
> = {
  essay: [TinyEssayEditor],
  bot: [BotEditor],
  tldraw: [TLDraw],
  datagrid: [DataGrid],
  kanban: [KanbanBoard],
};

export const annotationViewersForDocType: Record<
  string,
  Array<
    React.FC<{
      doc: unknown;
      handle: DocHandle<unknown>;
      annotations: Annotation<any, any>[];
    }>
  >
> = {
  essay: [EssayAnnotations],
  tldraw: [TLDrawAnnotations],
};

export interface DocEditorProps<T, V> {
  docUrl: AutomergeUrl;
  docHeads?: A.Heads;
  activeDiscussionIds?: string[];
  annotations?: AnnotationWithState<T, V>[];
  actorIdToAuthor?: Record<A.ActorId, AutomergeUrl>; // todo: can we replace that with memoize?

  setSelectedAnchors: (anchors: T[]) => void;
  setHoveredAnchor: (anchors: T) => void;
  selectedAnchors: T[];
  hoveredAnchor: T;
}
