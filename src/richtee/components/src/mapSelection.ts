import { TextSelection, Transaction } from "prosemirror-state"

export default function mapSelection(
  intercepted: Transaction,
  propagated: Transaction,
): Transaction {
  if (!intercepted.docChanged) {
    // There are no steps so we can just set the selection on the propagated
    // transaction to the selection on the intercepted transaction
    //
    const anchor = intercepted.mapping
      .invert()
      .map(intercepted.selection.anchor)
    const head = intercepted.mapping.invert().map(intercepted.selection.head)
    const $anchor = propagated.doc.resolve(anchor)
    const $head = propagated.doc.resolve(head)
    const selection = new TextSelection($anchor, $head)
    return propagated.setSelection(selection)
  }
  // get the selection at the start of the intercepted transasction by inverting the steps in it
  const anchor = intercepted.mapping.invert().map(intercepted.selection.anchor)
  const head = intercepted.mapping.invert().map(intercepted.selection.head)
  const $anchor = intercepted.docs[0].resolve(anchor)
  const $head = intercepted.docs[0].resolve(head)
  const initialSelection = new TextSelection($anchor, $head)

  // now map the initial selection through the propagated transaction
  const mapped = initialSelection.map(propagated.doc, propagated.mapping)
  return propagated.setSelection(mapped)
}
