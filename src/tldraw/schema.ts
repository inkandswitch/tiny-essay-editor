import { HasPatchworkMetadata } from "@/patchwork/schema";
import {
  SerializedSchema,
  SerializedStore,
  TLRecord,
  TLShapeId,
} from "@tldraw/tldraw";

export type TLDrawDoc = HasPatchworkMetadata<never, never> & {
  store: SerializedStore<TLRecord>;
  schema: SerializedSchema;
};

export type TLDrawDocAnchor = {
  shapeIds: TLShapeId[];
};
