import { HasPatchworkMetadata } from "@/patchwork/schema";
import { SerializedSchema, SerializedStore, TLRecord } from "@tldraw/tldraw";

export type TLDrawDoc = HasPatchworkMetadata & {
  store: SerializedStore<TLRecord>;
  schema: SerializedSchema;
};
