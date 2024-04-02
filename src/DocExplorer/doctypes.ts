import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { TLDrawDatatype } from "@/tldraw/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";

export interface DataType<T> {
  id: string;
  name: string;
  icon: any;
  init: (doc: T) => void;
  getTitle: (doc: T) => string;
  markCopy: (doc: T) => void;

  groupPatchesSpatially: (
    patches: A.Patch[],
    discussions: Discussion<T>[]
  ) => SpatialGroup<T>[];
}

// Store a list of tools that can be used with each doc type.
// This is a crude stand-in for a more flexible system based on matching
// data schemas with tool capabilities.
// It's important to store this mapping outside of the datatypes themselves;
// there might be tools a datatype doesn't know about which can edit the datatype.
// (A simple example is a raw JSON editor.)
export const toolsForDocTypes: Record<
  string,
  React.FC<DocEditorProps<unknown>>[]
> = {
  essay: [TinyEssayEditor],
  tldraw: [TLDraw],
};

export const docTypes = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
} as const;

export type DocType = keyof typeof docTypes;

export type ObjectSelection = {
  path: A.Prop;
  cursor?: A.Cursor;
};

export type RangeSelection = {
  from: ObjectSelection;
  to: ObjectSelection;
};

export type Selection = ObjectSelection | RangeSelection;

export type DiscussionComment = {
  id: string;
  content: string;
  contactUrl?: AutomergeUrl;
  timestamp: number;
};

export type Discussion<T> = {
  id: string;
  heads: A.Heads;
  resolved: boolean;
  comments: DiscussionComment[];
  target: T[];
};

export type EditGroup = {
  id: string;
  patches: A.Patch[];
};

export type SpatialGroup<T> = Discussion<T> | EditGroup;

export type Discussable<T> = {
  discussions: { [key: string]: Discussion<T> };
};

export type DocEditorProps<T> = {
  docUrl: AutomergeUrl;

  activeEditGroupIds?: string[];
  setActiveEditGroupIds: (ids: string[]) => void;
};
