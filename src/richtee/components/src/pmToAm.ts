import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
  ReplaceAroundStep,
  Step,
} from "prosemirror-transform"
import { Node } from "prosemirror-model"
import { Prop, next as automerge } from "@automerge/automerge"
import { blocksFromNode, pmRangeToAmRange } from "./traversal"
import { next as am } from "@automerge/automerge"

export type ChangeFn<T> = (doc: T, field: string) => void

export default function (
  spans: am.Span[],
  step: Step,
  doc: any,
  pmDoc: Node,
  attr: Prop,
) {
  // This shenanigans with the constructor name is necessary for reasons I
  // don't really understand. I _think_ that the `*Step` classs we get
  // passed here can be slightly different to the classes we've imported if the
  // dependencies are messed up
  if (
    step.constructor.name === "ReplaceStep" ||
    step.constructor.name === "_ReplaceStep"
  ) {
    replaceStep(spans, step as ReplaceStep, doc, attr, pmDoc)
  } else if (
    step.constructor.name === "ReplaceAroundStep" ||
    step.constructor.name === "_ReplaceAroundStep"
  ) {
    replaceAroundStep(step as ReplaceAroundStep, doc, pmDoc, attr)
  } else if (
    step.constructor.name === "AddMarkStep" ||
    step.constructor.name === "_AddMarkStep"
  ) {
    addMarkStep(spans, step as AddMarkStep, doc, attr)
  } else if (
    step.constructor.name === "RemoveMarkStep" ||
    step.constructor.name === "_RemoveMarkStep"
  ) {
    removeMarkStep(spans, step as RemoveMarkStep, doc, attr)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replaceStep(
  spans: am.Span[],
  step: ReplaceStep,
  doc: automerge.Doc<unknown>,
  field: Prop,
  pmDoc: Node,
) {
  if (
    step.slice.content.childCount === 1 &&
    step.slice.content.firstChild?.isText
  ) {
    // This is a text insertion or deletion
    const amRange = pmRangeToAmRange(spans, { from: step.from, to: step.to })
    if (amRange == null) {
      throw new Error(
        `Could not find range (${step.from}, ${step.to}) in render tree`,
      )
    }
    let { start, end } = amRange
    if (start > end) {
      ;[start, end] = [end, start]
    }

    const toDelete = end - start
    automerge.splice(
      doc,
      [field],
      start,
      toDelete,
      step.slice.content.firstChild.text,
    )
    return
  }
  const applied = step.apply(pmDoc).doc
  if (applied == null) {
    throw new Error("Could not apply step to document")
  }
  //console.log(JSON.stringify(applied, null, 2))
  const newBlocks = blocksFromNode(applied)
  //console.log(JSON.stringify(newBlocks, null, 2))
  automerge.updateBlocks(doc, [field], newBlocks)
}

function replaceAroundStep(
  step: ReplaceAroundStep,
  doc: any,
  pmDoc: Node,
  field: Prop,
) {
  const applied = step.apply(pmDoc).doc
  if (applied == null) {
    throw new Error("Could not apply step to document")
  }
  console.log(JSON.stringify(applied, null, 2))
  const newBlocks = blocksFromNode(applied)
  console.log(JSON.stringify(newBlocks, null, 2))
  automerge.updateBlocks(doc, [field], newBlocks)
}

function addMarkStep(
  spans: am.Span[],
  step: AddMarkStep,
  doc: automerge.Doc<unknown>,
  field: Prop,
) {
  const amRange = pmRangeToAmRange(spans, { from: step.from, to: step.to })
  if (amRange == null) {
    throw new Error(
      `Could not find range (${step.from}, ${step.to}) in render tree`,
    )
  }
  const { start, end } = amRange
  const markName = step.mark.type.name
  const expand = step.mark.type.spec.inclusive ? "both" : "none"
  let value: string | boolean = true
  if (step.mark.attrs != null && Object.keys(step.mark.attrs).length > 0) {
    value = JSON.stringify(step.mark.attrs)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  automerge.mark(doc as any, [field], { start, end, expand }, markName, value)
}

function removeMarkStep(
  spans: am.Span[],
  step: RemoveMarkStep,
  doc: automerge.Doc<unknown>,
  field: Prop,
) {
  const amRange = pmRangeToAmRange(spans, { from: step.from, to: step.to })
  if (amRange == null) {
    throw new Error(
      `Could not find range (${step.from}, ${step.to}) in render tree`,
    )
  }
  const { start, end } = amRange
  if (start == null || end == null) {
    throw new Error(
      `Could not find step.from (${step.from}) or step.to (${step.to}) in render tree`,
    )
  }
  const markName = step.mark.type.name
  const expand = step.mark.type.spec.inclusive ? "both" : "none"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  automerge.unmark(doc as any, [field], { start, end, expand }, markName)
}
