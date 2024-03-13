import { Prop } from "@automerge/automerge"
import { next as am } from "@automerge/automerge"
import { EditorState, Transaction, TextSelection } from "prosemirror-state"
import pmToAm from "./pmToAm"
import amToPm from "./amToPm"
import { DocHandle } from "./DocHandle"

export function intercept<T>(
  path: am.Prop[],
  handle: DocHandle<T>,
  intercepted: Transaction,
  state: EditorState,
): EditorState {

  const docBefore = handle.docSync()
  if (docBefore === undefined) throw new Error("handle is not ready")
  const headsBefore = am.getHeads(docBefore)
  const spansBefore = am.spans(docBefore, path)

  // Apply the incoming transaction to the automerge doc
  handle.change(d => {
    const [subdoc, attr] = docAndAttr(d, path)
    for (let i = 0; i < intercepted.steps.length; i++) {
      const spans = am.spans(handle.docSync()!, path)
      const step = intercepted.steps[i]
      console.log(step)
      const pmDoc = intercepted.docs[i]
      pmToAm(spans, step, subdoc, pmDoc, attr)
    }
  })

  //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const headsAfter = am.getHeads(handle.docSync()!)
  if (headsEqual(headsBefore, headsAfter)) {
    return state.apply(intercepted)
  }

  // Get the corresponding patches and turn them into a transaction to apply to the editorstate
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const diff = am.diff(handle.docSync()!, headsBefore, headsAfter)
  console.log("Intercept diff: ")
  console.log(diff)

  // Create a transaction which applies the diff and updates the doc and heads
  let tx = amToPm(state.schema, spansBefore, diff, path, state.tr, true)
  const selectionAfter = state.apply(intercepted).selection
  const resolvedSelectionAfter = new TextSelection(
    tx.doc.resolve(selectionAfter.from),
    tx.doc.resolve(selectionAfter.to),
  )
  tx = tx.setSelection(resolvedSelectionAfter)

  return state.apply(tx)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function docAndAttr(doc: any, path: Prop[]): [any, Prop] {
  const result_path = path.slice()
  while (result_path.length > 1) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    doc = doc[result_path.shift()!]
  }
  return [doc, path[0]]
}

function headsEqual(headsBefore: am.Heads, headsAfter: am.Heads): boolean {
  if (headsBefore.length !== headsAfter.length) return false
  for (let i = 0; i < headsBefore.length; i++) {
    if (headsBefore[i] !== headsAfter[i]) return false
  }
  return true
}
