import { next as am } from "@automerge/automerge"
import { Heads } from "@automerge/automerge"
import { EditorState, Text, Transaction } from "@codemirror/state"
import { type Field } from "./plugin"

type Update = (
  atHeads: Heads,
  change: (doc: am.Doc<unknown>) => void
) => Heads | undefined

export default function (
  field: Field,
  update: Update,
  transactions: Transaction[],
  state: EditorState
): Heads | undefined {
  const { lastHeads, path } = state.field(field)

  // We don't want to call `automerge.updateAt` if there are no changes.
  // Otherwise later on `automerge.diff` will return empty patches that result in a no-op but still mess up the selection.
  let hasChanges = false
  for (const tr of transactions) {
    if (!tr.changes.empty) {
      tr.changes.iterChanges(() => {
        hasChanges = true
      })
    }
  }

  if (!hasChanges) {
    return undefined
  }

  const newHeads = update(lastHeads, (doc: am.Doc<unknown>) => {
    for (const tr of transactions) {
      tr.changes.iterChanges(
        (
          fromA: number,
          toA: number,
          fromB: number,
          _toB: number,
          inserted: Text
        ) => {
          // We are cloning the path as `am.splice` calls `.unshift` on it, modifying it in place,
          // causing the path to be broken on subsequent changes
          am.splice(doc, path.slice(), fromB, toA - fromA, inserted.toString())
        }
      )
    }
  })
  return newHeads
}
