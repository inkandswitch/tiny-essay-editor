import { HasVersionControlMetadata } from "@/os/versionControl/schema";
import {
  SerializedSchema,
  SerializedStore,
  TLRecord,
  TLShapeId,
} from "@tldraw/tldraw";

export type TLDrawDoc = HasVersionControlMetadata<never, never> & {
  store: SerializedStore<TLRecord>;
  schema: SerializedSchema;
};

export type TLDrawDocAnchor = TLShapeId;
