import { next as A } from "@automerge/automerge";
import { AutomergeUrl } from "@automerge/automerge-repo";
import { TLDrawDatatype } from "@/tldraw/datatype";
import { EssayDatatype } from "@/tee/datatype";
import { TinyEssayEditor } from "@/tee/components/TinyEssayEditor";
import { TLDraw } from "@/tldraw/components/TLDraw";

export interface DataType<D, T, V> {
  id: string;
  name: string;
  icon: any;
  init: (doc: D) => void;
  getTitle: (doc: D) => string;
  markCopy: (doc: D) => void;

  getAnnotations?: (
    docBefore: D,
    docAfter: D,
    patches: A.Patch[],
    discussions: Discussion<T>[]
  ) => Annotation<T, V>[];

  groupAnnotationsSpatially?: <T, V>(
    annotations: A.Patch[],
    discussions: Discussion<T>[]
  ) => SpatialGroup<T, V>[];
}

// Store a list of tools that can be used with each doc type.
// This is a crude stand-in for a more flexible system based on matching
// data schemas with tool capabilities.
// It's important to store this mapping outside of the datatypes themselves;
// there might be tools a datatype doesn't know about which can edit the datatype.
// (A simple example is a raw JSON editor.)
export const toolsForDocTypes: Record<
  string,
  React.FC<DocEditorProps<unknown, unknown>>[]
> = {
  essay: [TinyEssayEditor],
  tldraw: [TLDraw],
};

export const docTypes = {
  essay: EssayDatatype,
  tldraw: TLDrawDatatype,
} as const;

export type DocType = keyof typeof docTypes;

export type AnnotationId = string & { __annotationId: true };

interface AddAnnotation<T, V> {
  type: "added";
  target: T;
  added: V;
  discussion?: Discussion<T>;
}

interface DeleteAnnotation<T, V> {
  type: "deleted";
  target: T;
  deleted: V;
  discussion?: Discussion<T>;
}

interface ChangeAnnotation<T, V> {
  type: "changed";
  target: T;
  before: V;
  after: V;
  discussion?: Discussion<T>;
}

export interface HighlightAnnotation<T, V> {
  type: "highlighted";
  target: T;
  value: V;
  discussion?: Discussion<T>;
}

export type Annotation<T, V> =
  | AddAnnotation<T, V>
  | DeleteAnnotation<T, V>
  | ChangeAnnotation<T, V>
  | HighlightAnnotation<T, V>;

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

export type AnnotationGroup<T, V> = {
  id: string;
  annotations: Annotation<T, V>;
};

export type SpatialGroup<T, V> = Discussion<T> | AnnotationGroup<T, V>;

export type Discussable<T, V> = {
  discussions: { [key: string]: Discussion<T> };
};

export type HasMetadata<T, V> = Discussable<T, V>;

export type DocEditorProps<T, V> = {
  docUrl: AutomergeUrl;

  selectedAnnotations: Annotation<T, V>[];
  hoveredAnnotation: Annotation<T, V>;
  setHoveredAnnotation: (annotation: Annotation<T, V>) => void;
  setSelectedAnnotations: (annotations: Annotation<T, V>[]) => void;
};
