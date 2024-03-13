import { next as automerge } from "@automerge/automerge"
import { EditorState, Transaction } from "prosemirror-state"
import amToPm from "./amToPm"
import { intercept } from "./intercept"
import { DocHandle } from "./DocHandle"
import { next as am } from "@automerge/automerge"

type Doc<T> = automerge.Doc<T>
type Patch = automerge.Patch

export default class PatchSemaphore<T> {
  _inLocalTransaction = false
  path: am.Prop[]

  constructor(path: am.Prop[]) {
    this.path = path
  }

  intercept = (
    handle: DocHandle<T>,
    intercepted: Transaction,
    state: EditorState,
  ): EditorState => {
    this._inLocalTransaction = true
    const result = intercept(this.path, handle, intercepted, state)
    this._inLocalTransaction = false
    return result
  }

  reconcilePatch = (
    docBefore: Doc<T>,
    docAfter: Doc<T>,
    patches: Patch[],
    state: EditorState,
  ): EditorState => {
    if (this._inLocalTransaction) {
      return state
    }
    console.log("reconciling")
    console.log(patches)
    const headsBefore = automerge.getHeads(docBefore)

    const spans = automerge.spans(automerge.view(docAfter, headsBefore), this.path)
    const tx = amToPm(state.schema, spans, patches, this.path, state.tr, false)
    return state.apply(tx)
  }
}
