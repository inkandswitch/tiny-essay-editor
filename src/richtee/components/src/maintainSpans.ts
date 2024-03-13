import { next as am } from "@automerge/automerge"

export function patchSpans(spans: am.Span[], patch: am.Patch) {
  if (patch.action === "splice") {
    spliceSpans(spans, patch)
  } else if (patch.action === "del") {
    deleteSpans(spans, patch)
  } else if (patch.action === "splitBlock") {
    splitBlockSpans(spans, patch)
  } else if (patch.action === "updateBlock") {
    updateBlockSpans(spans, patch)
  } else if (patch.action === "joinBlock") {
    joinBlockSpans(spans, patch)
  }
}

function spliceSpans(spans: am.Span[], patch: am.SpliceTextPatch) {
  let idx = 0
  const patchIndex = patch.path[patch.path.length - 1]
  if (typeof patchIndex !== "number") {
    return
  }

  for (const span of spans) {
    if (span.type === "text") {
      if (idx + span.value.length < patchIndex) {
        const offset = patchIndex - idx
        const before = span.value.slice(0, offset)
        const after = span.value.slice(offset)
        span.value = before + patch.value + after
        return
      } else {
        idx += span.value.length
      }
    } else {
      idx += 1
    }
  }
}

function deleteSpans(spans: am.Span[], patch: am.DelPatch) {
  let idx = 0
  const patchIndex = patch.path[patch.path.length - 1]
  if (typeof patchIndex !== "number") {
    return
  }

  for (const [index, span] of spans.entries()) {
    if (span.type === "text") {
      if (idx + span.value.length > patchIndex) {
        const offset = patchIndex - idx
        const before = span.value.slice(0, offset)
        const after = span.value.slice(offset + (patch.length || 1))
        span.value = before + after
        if (span.value === "") {
          spans.splice(index, 1)
        }
        return
      } else {
        idx += span.value.length
      }
    } else {
      idx += 1
    }
  }
}

function splitBlockSpans(spans: am.Span[], patch: am.SplitBlockPatch) {
  let idx = 0
  let spanIdx = 0
  while (idx < patch.index && spanIdx < spans.length) {
    const span = spans[spanIdx]
    if (span.type == "text") {
      if (span.value.length + idx > patch.index) {
        const offset = patch.index - idx
        const left = span.value.slice(0, offset)
        const right = span.value.slice(offset)
        span.value = left
        spans.splice(spanIdx + 1, 0, {
          type: "block",
          value: {
            type: patch.type,
            parents: patch.parents,
            attrs: patch.attrs,
          },
        })
        spans.splice(spanIdx + 2, 0, {
          type: "text",
          value: right,
        })
        return
      }
      idx += span.value.length
    } else {
      idx += 1
    }
    spanIdx += 1
  }
  spans.splice(spanIdx, 0, {
    type: "block",
    value: { type: patch.type, parents: patch.parents, attrs: patch.attrs },
  })
}

function updateBlockSpans(spans: am.Span[], patch: am.UpdateBlockPatch) {
  const spanIdx = findBlockSpanIdx(spans, patch.index)
  if (spanIdx === null) {
    throw new Error("Could not find block span")
  }
  const span = spans[spanIdx] as {
    type: "block"
    value: {
      type: string
      parents: string[]
      attrs: { [key: string]: am.BlockAttrValue }
    }
  }
  if (span.type === "block") {
    if (patch.new_type != null) {
      span.value.type = patch.new_type
    }
    if (patch.new_parents != null) {
      span.value.parents = patch.new_parents
    }
    if (patch.new_attrs != null) {
      span.value.attrs = patch.new_attrs
    }
  }
}

function joinBlockSpans(spans: am.Span[], patch: am.JoinBlockPatch) {
  const spanIdx = findBlockSpanIdx(spans, patch.index)
  if (spanIdx === null) {
    throw new Error("Could not find block span")
  }
  spans.splice(spanIdx, 1)
  const prevSpan = spans[spanIdx - 1]
  const nextSpan = spans[spanIdx]
  if (nextSpan != null && prevSpan != null) {
    if (prevSpan.type === "text" && nextSpan.type === "text") {
      prevSpan.value += nextSpan.value
      spans.splice(spanIdx, 1)
    }
  }
}

function findBlockSpanIdx(spans: am.Span[], blockIdx: number): number | null {
  let idx = 0
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (span.type === "block") {
      if (idx === blockIdx) {
        return i
      }
      idx += 1
    } else if (span.type === "text") {
      idx += span.value.length
    }
  }
  return null
}
