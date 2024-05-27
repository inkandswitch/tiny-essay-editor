import { TLStoreSnapshot } from "@tldraw/tldraw"
import { DEFAULT_STORE } from './default_store.js'

/* a similar pattern to other automerge init functions */
export function init(doc: TLStoreSnapshot) {
  Object.assign(doc, DEFAULT_STORE)
}

export * from './useAutomergeStore.js'
