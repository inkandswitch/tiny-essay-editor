export { default as PatchSemaphore } from "./PatchSemaphore"
export { schema } from "./schema"
export { type MarkMap } from "./marks"
export { defaultMarkMap } from "./marks"
export { type DocHandle } from "./DocHandle"
import { docFromSpans } from "./traversal"
import { type DocHandle } from "./DocHandle"
import { Node } from "prosemirror-model"
import { next as am } from "@automerge/automerge"

export function initialize(handle: DocHandle<unknown>, path: am.Prop[]): Node {
  const doc = handle.docSync()
  if (doc === undefined) throw new Error("Handle is not ready")
  const spans = am.spans(doc, path)
  return docFromSpans(spans)
}
