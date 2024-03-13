import { HasPatchworkMetadata } from "@/patchwork/schema";
import { SerializedSchema, SerializedStore, TLRecord } from "@tldraw/tldraw";

export type TLDrawDoc = HasPatchworkMetadata<never, never> & {
  store: SerializedStore<TLRecord>;
  schema: SerializedSchema;
};
