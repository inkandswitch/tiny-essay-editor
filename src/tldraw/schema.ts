import { SerializedSchema, SerializedStore, TLRecord } from "@tldraw/tldraw"

export type TLDrawDoc = {
  store: SerializedStore<TLRecord>
  schema: SerializedSchema
}
