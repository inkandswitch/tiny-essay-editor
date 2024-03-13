import { next as am, DelPatch, Patch, type Prop } from "@automerge/automerge"
import {
  Fragment,
  Slice,
  Mark,
  Attrs,
  Schema,
  NodeType,
} from "prosemirror-model"
import { TextSelection, Transaction } from "prosemirror-state"
import { MarkValue } from "./marks"
import {
  amIdxToPmBlockIdx,
  amSpliceIdxToPmIdx,
  docFromSpans,
} from "./traversal"
import { patchSpans } from "./maintainSpans"
import { printTree } from "../test/utils"

type SpliceTextPatch = am.SpliceTextPatch
type InsertPatch = am.InsertPatch

type MarkSet = {
  [name: string]: MarkValue
}

type MarkPatch = {
  action: "mark"
  path: Prop[]
  marks: am.Mark[]
}

export default function (
  schema: Schema,
  spansAtStart: am.Span[],
  patches: Array<Patch>,
  path: Prop[],
  tx: Transaction,
  isLocal: boolean,
): Transaction {
  let result = tx
  for (const patch of patches) {
    console.log(JSON.stringify(patch))
    if (patch.action === "insert") {
      result = handleInsert(schema, patch, path, result)
      patchSpans(spansAtStart, patch)
    } else if (patch.action === "splice") {
      result = handleSplice(schema, spansAtStart, patch, path, result, isLocal)
      patchSpans(spansAtStart, patch)
    } else if (patch.action === "del") {
      result = handleDelete(schema, spansAtStart, patch, path, result)
      patchSpans(spansAtStart, patch)
    } else if (patch.action === "mark") {
      result = handleMark(spansAtStart, schema, patch, path, result)
      patchSpans(spansAtStart, patch)
    } else if (
      patch.action === "splitBlock" ||
      patch.action === "joinBlock" ||
      patch.action === "updateBlock"
    ) {
      handleBlockChange(schema, spansAtStart, patch, tx, isLocal)
    }
  }
  return result
}

function handleInsert(
  schema: Schema,
  patch: InsertPatch,
  path: Prop[],
  tx: Transaction,
): Transaction {
  //const index = charPath(path, patch.path)
  //if (index === null) return tx
  //const pmIdx = amIdxToPmIdx(tx.doc, index)
  //if (pmIdx == null) throw new Error("Invalid index")
  //const content = patchContentToSlice(schema, patch.values.join(""), patch.marks)
  //return tx.replace(pmIdx, pmIdx, content)
  return tx
}

export function handleSplice(
  schema: Schema,
  spans: am.Span[],
  patch: SpliceTextPatch,
  path: Prop[],
  tx: Transaction,
  isLocal: boolean,
): Transaction {
  const index = charPath(path, patch.path)
  if (index === null) return tx
  const pmIdx = amSpliceIdxToPmIdx(spans, index)
  if (pmIdx == null) throw new Error("Invalid index")
  const content = patchContentToFragment(schema, patch.value, patch.marks)
  tx = tx.replace(pmIdx, pmIdx, new Slice(content, 0, 0))
  if (isLocal) {
    const sel = tx.doc.resolve(pmIdx + content.size)
    tx = tx.setSelection(new TextSelection(sel, sel))
  }
  return tx
}

function handleDelete(
  schema: Schema,
  spans: am.Span[],
  patch: DelPatch,
  path: Prop[],
  tx: Transaction,
): Transaction {
  const index = charPath(path, patch.path)
  if (index === null) return tx
  const start = amSpliceIdxToPmIdx(spans, index)
  if (start == null) throw new Error("Invalid index")
  const end = start + (patch.length || 1)
  return tx.delete(start, end)
}

function handleMark(
  spans: am.Span[],
  schema: Schema,
  patch: MarkPatch,
  path: Prop[],
  tx: Transaction,
) {
  if (pathEquals(patch.path, path)) {
    for (const mark of patch.marks) {
      const pmStart = amSpliceIdxToPmIdx(spans, mark.start)
      const pmEnd = amSpliceIdxToPmIdx(spans, mark.end)
      if (pmStart == null || pmEnd == null) throw new Error("Invalid index")
      const markType = schema.marks[mark.name]
      if (markType == null) continue
      if (mark.value == null) {
        tx = tx.removeMark(pmStart, pmEnd, markType)
      } else {
        const markAttrs = attrsFromMark(mark.value)
        tx = tx.addMark(pmStart, pmEnd, markType.create(markAttrs))
      }
    }
  }
  return tx
}

export function handleBlockChange(
  schema: Schema,
  spans: am.Span[],
  patch: am.SplitBlockPatch | am.JoinBlockPatch | am.UpdateBlockPatch,
  tx: Transaction,
  isLocal: boolean,
): Transaction {
  patchSpans(spans, patch)
  //console.log(JSON.stringify(spans, null, 2))
  const docAfter = docFromSpans(spans)
  //console.log(JSON.stringify(docAfter, null, 2))
  const change = findDiff(tx.doc.content, docAfter.content)
  if (change == null) return tx

  const $from = docAfter.resolve(change.start)
  const $to = docAfter.resolve(change.endB)
  const $fromA = tx.doc.resolve(change.start)
  const inlineChange =
    $from.sameParent($to) &&
    $from.parent.inlineContent &&
    $fromA.end() >= change.endA

  const chFrom = change.start
  const chTo = change.endA

  let handledByInline = false
  if (inlineChange) {
    if ($from.pos == $to.pos) {
      // Deletion
      handledByInline = true
      tx = tx.delete(chFrom, chTo)
    } else if (
      $from.parent.child($from.index()).isText &&
      $from.index() == $to.index() - ($to.textOffset ? 0 : 1)
    ) {
      handledByInline = true
      // Both positions in the same text node -- simply insert text
      const text = $from.parent.textBetween(
        $from.parentOffset,
        $to.parentOffset,
      )
      tx = tx.insertText(text, chFrom, chTo)
    }
  }
  if (!handledByInline) {
    tx = tx.replace(chFrom, chTo, docAfter.slice(change.start, change.endB))
  }
  if (isLocal) {
    const blockIdx = amIdxToPmBlockIdx(spans, patch.index)
    if (blockIdx == null) throw new Error("Invalid index")
    tx = tx.setSelection(TextSelection.create(tx.doc, blockIdx))
  }

  return tx
}

function findDiff(
  a: Fragment,
  b: Fragment,
): { start: number; endA: number; endB: number } | null {
  let start = a.findDiffStart(b)
  if (start == null) return null
  //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let { a: endA, b: endB } = a.findDiffEnd(b)!
  if (endA < start && a.size < b.size) {
    if (
      start &&
      start < b.size &&
      isSurrogatePair(b.textBetween(start - 1, start + 1))
    )
      start -= 1
    endB = start + (endB - endA)
    endA = start
  } else if (endB < start) {
    if (
      start &&
      start < a.size &&
      isSurrogatePair(a.textBetween(start - 1, start + 1))
    )
      start -= 1
    endA = start + (endA - endB)
    endB = start
  }
  return { start, endA, endB }
}

function isSurrogatePair(str: string) {
  if (str.length != 2) return false
  const a = str.charCodeAt(0),
    b = str.charCodeAt(1)
  return a >= 0xdc00 && a <= 0xdfff && b >= 0xd800 && b <= 0xdbff
}

// If the path of the patch is of the form [path, <index>] then we know this is
// a path to a character within the sequence given by path
function charPath(textPath: Prop[], candidatePath: Prop[]): number | null {
  if (candidatePath.length !== textPath.length + 1) return null
  for (let i = 0; i < textPath.length; i++) {
    if (textPath[i] !== candidatePath[i]) return null
  }
  const index = candidatePath[candidatePath.length - 1]
  if (typeof index === "number") return index
  return null
}

function pathEquals(path1: Prop[], path2: Prop[]): boolean {
  if (path1.length !== path2.length) return false
  for (let i = 0; i < path1.length; i++) {
    if (path1[i] !== path2[i]) return false
  }
  return true
}

function patchContentToFragment(
  schema: Schema,
  patchContent: string,
  marks?: MarkSet,
): Fragment {
  let pmMarks: Array<Mark> | undefined = undefined
  if (marks != null) {
    pmMarks = Object.entries(marks).reduce(
      (acc: Mark[], [name, value]: [string, MarkValue]) => {
        // This should actually never be null because automerge only uses null
        // as the value for a mark when a mark is being removed, which would only
        // happen in a `AddMark` patch, not a `Insert` or `Splice` patch. But we
        // appease typescript anyway
        if (value != null) {
          const markAttrs = attrsFromMark(value)
          acc.push(schema.mark(name, markAttrs))
        }
        return acc
      },
      [],
    )
  }

  // Splice is only ever called once a block has already been created so we're
  // only inserting text. This means we don't have to think about openStart
  // and openEnd
  return Fragment.from(schema.text(patchContent, pmMarks))
}

export function attrsFromMark(mark: MarkValue): Attrs | null {
  let markAttrs = null
  if (typeof mark === "string") {
    try {
      const markJson = JSON.parse(mark)
      if (typeof markJson === "object") {
        markAttrs = markJson as Attrs
      }
    } catch (e) {
      // ignore
    }
  }
  return markAttrs
}
