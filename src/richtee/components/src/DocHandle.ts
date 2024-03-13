import { next as am } from "@automerge/automerge"

export interface DocHandle<T> {
  docSync: () => am.Doc<T> | undefined
  change: (fn: am.ChangeFn<T>) => void
}
