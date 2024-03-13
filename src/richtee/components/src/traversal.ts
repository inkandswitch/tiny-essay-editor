import { next as am } from "@automerge/automerge"
import { Mark, Node, Schema } from "prosemirror-model"
import { isBlockMetadata, BlockMetadata, BlockType } from "./types"
import { schema } from "./schema"
import { BlockAttrValue } from "@automerge/automerge/dist/next_types"
import { attrsFromMark } from "./amToPm"

type RenderRole = "explicit" | "render-only"

export type TraversalEvent =
  | { type: "openTag"; tag: string; role: RenderRole }
  | { type: "closeTag"; tag: string; role: RenderRole }
  | { type: "leafNode"; tag: string; role: RenderRole }
  | { type: "text"; text: string; marks: am.MarkSet }
  | { type: "block"; block: BlockMetadata }

export function docFromSpans(spans: am.Span[]): Node {
  const events = traverseSpans(spans)
  type StackItem = {
    tag: string
    attrs: { [key: string]: any }
    children: Node[]
  }
  const stack: StackItem[] = [
    {
      tag: "doc",
      attrs: {},
      children: [],
    },
  ]
  let nextBlockAmgAttrs: { [key: string]: am.BlockAttrValue } | null = null

  for (const event of events) {
    if (event.type === "openTag") {
      stack.push({
        tag: event.tag,
        attrs: nextBlockAmgAttrs || {},
        children: [],
      })
    } else if (event.type === "closeTag") {
      //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { children, attrs, tag } = stack.pop()!
      const node = constructNode(schema, tag, attrs, children)
      stack[stack.length - 1].children.push(node)
    } else if (event.type === "leafNode") {
      stack[stack.length - 1].children.push(
        constructNode(schema, event.tag, nextBlockAmgAttrs || {}, []),
      )
    } else if (event.type === "text") {
      let pmMarks: Mark[] = []
      if (event.marks != null) {
        pmMarks = Object.entries(event.marks).reduce(
          (acc: Mark[], [name, value]: [string, am.MarkValue]) => {
            if (value != null) {
              const markAttrs = attrsFromMark(value)
              acc.push(schema.mark(name, markAttrs))
            }
            return acc
          },
          [],
        )
      }
      stack[stack.length - 1].children.push(schema.text(event.text, pmMarks))
    }

    if (event.type === "block") {
      nextBlockAmgAttrs = { isAmgBlock: true, ...event.block.attrs }
    } else {
      nextBlockAmgAttrs = null
    }
  }
  if (stack.length !== 1) {
    throw new Error("Invalid stack length")
  } else {
    const { children, attrs, tag } = stack[0]
    return constructNode(schema, tag, attrs, children)
  }
}

function constructNode(
  schema: Schema,
  nodeName: string,
  attrs: { [key: string]: any },
  children: Node[],
): Node {
  if (nodeName === "ordered-list") {
    return schema.node("ordered_list", attrs, children)
  } else if (nodeName === "unordered-list") {
    return schema.node("bullet_list", attrs, children)
  } else if (nodeName === "list-item") {
    return schema.node("list_item", attrs, children)
  } else {
    return schema.node(nodeName, attrs, children)
  }
}

export function amSpliceIdxToPmIdx(
  spans: am.Span[],
  target: number,
): number | null {
  const events = eventsWithIndexChanges(traverseSpans(spans))
  let maxInsertableIndex = null

  for (const state of events) {
    if (state.before.amIdx >= target && maxInsertableIndex != null) {
      return maxInsertableIndex
    }
    if (state.event.type === "openTag") {
      if (state.event.tag === "paragraph") {
        maxInsertableIndex = state.after.pmIdx
      }
    } else if (state.event.type === "leafNode") {
      maxInsertableIndex = state.after.pmIdx
    } else if (state.event.type === "text") {
      maxInsertableIndex = state.after.pmIdx
      if (state.after.amIdx >= target) {
        if (state.before.amIdx + state.event.text.length >= target) {
          const diff = target - state.before.amIdx
          return state.before.pmIdx + diff - 1
        }
      }
    }
  }
  return maxInsertableIndex
}

export function amIdxToPmBlockIdx(
  spans: am.Span[],
  target: number,
): number | null {
  const events = eventsWithIndexChanges(traverseSpans(spans))
  let lastBlockStart = null
  let isFirstTag = true

  for (const state of events) {
    if (state.event.type === "openTag") {
      if (state.event.role === "explicit") {
        lastBlockStart = state.after.pmIdx
      } else if (state.event.tag === "paragraph" && isFirstTag) {
        // If there's a render-only opening paragraph then everything before
        // the first block marker should be inside it
        lastBlockStart = state.after.pmIdx
      }
      isFirstTag = false
    } else if (state.event.type === "block") {
      if (state.after.amIdx === target) {
        return state.after.pmIdx + 1
      }
    }
    if (state.after.amIdx >= target) {
      return lastBlockStart
    }
  }
  return lastBlockStart
}

type Indexes = {
  amIdx: number
  pmIdx: number
}

export function* eventsWithIndexChanges(
  events: IterableIterator<TraversalEvent>,
): IterableIterator<{
  event: TraversalEvent
  before: Indexes
  after: Indexes
}> {
  let pmOffset = 0
  let amOffset = -1

  while (true) {
    const next = events.next()
    if (next.done) {
      return
    }
    const event = next.value
    const before = { amIdx: amOffset, pmIdx: pmOffset }

    if (event.type === "openTag" && event.tag !== "doc") {
      pmOffset += 1
    } else if (event.type === "closeTag" && event.tag !== "doc") {
      pmOffset += 1
    } else if (event.type === "leafNode") {
      pmOffset += 1
    } else if (event.type === "text") {
      amOffset += event.text.length
      pmOffset += event.text.length
    } else if (event.type === "block") {
      amOffset += 1
    }
    const after = { amIdx: amOffset, pmIdx: pmOffset }
    yield { event, before, after }
  }
}

export function* traverseNode(node: Node): IterableIterator<TraversalEvent> {
  const toProcess: (
    | TraversalEvent
    | { type: "node"; node: Node; parent: Node | null; indexInParent: number }
  )[] = [
    {
      node,
      parent: null,
      indexInParent: 0,
      type: "node",
    },
  ]
  const path: string[] = []
  const nodePath: Node[] = []

  while (toProcess.length > 0) {
    const next = toProcess.pop()
    if (next == null) {
      return
    }
    if (next.type === "node") {
      const cur = next.node
      if (cur.isText) {
        yield { type: "text", text: cur.text!, marks: {} }
      } else {
        let blockType: BlockType | null = null
        const attrs: { [key: string]: BlockAttrValue } = {}
        const nodeType = cur.type.name
        if (nodeType === "list_item") {
          const parentNode = nodePath[nodePath.length - 1]
          if (parentNode == null) {
            throw new Error("li must have a parent")
          }
          if (parentNode.type.name === "ordered_list") {
            blockType = "ordered-list-item"
          } else if (parentNode.type.name === "bullet_list") {
            blockType = "unordered-list-item"
          } else {
            throw new Error("li must have a parent of ol or ul")
          }
        } else if (nodeType === "paragraph") {
          blockType = nodeType
        } else if (nodeType === "heading") {
          blockType = nodeType
          attrs.level = cur.attrs.level
        } else if (nodeType === "aside") {
          blockType = nodeType
        } else if (nodeType === "image") {
          blockType = nodeType
          attrs.isEmbed = true
          attrs.src = cur.attrs.src
          attrs.alt = cur.attrs.alt
          attrs.title = cur.attrs.title
        } else if (nodeType === "blockquote") {
          blockType = nodeType
        } else if (nodeType === "code_block") {
          blockType = "code-block"
        }

        let role: RenderRole = "render-only"
        if (cur.attrs.isAmgBlock) {
          role = "explicit"
        } else {
          let hasExplicitDescendant = false
          cur.descendants(desc => {
            if (desc.attrs.isAmgBlock) {
              hasExplicitDescendant = true
              return false
            }
            return true
          })
          if (cur.type.name === "list_item") {
            if (!hasExplicitDescendant) {
              role = "explicit"
            }
          } else if (cur.type.name === "paragraph") {
            if (next.indexInParent > 0) {
              role = "explicit"
            } else {
              // If the paragraph is an empty paragraph and there's one following
              // child in the list item which is a block element then the paragraph
              // is filler content
              const parent = next.parent
              if (parent != null) {
                if (parent.type.name === "list_item") {
                  if (parent.childCount === 2) {
                    if (
                      parent.child(1).type.name !== "ordered_list" &&
                      parent.child(1).type.name !== "bullet_list"
                    ) {
                      role = "explicit"
                    }
                  }
                } else if (parent.type.name === "doc") {
                  if (parent.childCount > 1) {
                    role = "explicit"
                  }
                } else if (parent.type.name === "aside") {
                  role = "explicit"
                } else if (parent.type.name === "blockquote") {
                  if (parent.childCount > 0) {
                    role = "explicit"
                  }
                }
              }
            }
          } else if (cur.type.name === "heading") {
            role = "explicit"
          } else if (cur.type.name === "image") {
            role = "explicit"
          } else if (cur.type.name === "code_block") {
            role = "explicit"
          }
        }

        if (role === "explicit" && blockType != null) {
          yield {
            type: "block",
            block: { type: blockType, parents: findParents(nodePath), attrs },
          }
        }
        yield { type: "openTag", tag: cur.type.name, role }
        nodePath.push(cur)
        if (blockType != null && role === "explicit") {
          path.push(blockType)
        }

        toProcess.push({ type: "closeTag", tag: cur.type.name, role })
        for (let i = cur.childCount - 1; i >= 0; i--) {
          toProcess.push({
            parent: cur,
            indexInParent: i,
            type: "node",
            node: cur.child(i),
          })
        }
      }
    } else {
      if (next.type === "closeTag") {
        if (next.role === "explicit") {
          path.pop()
        }
        nodePath.pop()
      }
      yield next
    }
  }
}

function findParents(parentNodes: Node[]): string[] {
  const parents: string[] = []
  for (const [index, node] of parentNodes.entries()) {
    if (node.type.name === "bullet_list" && index < parentNodes.length - 1) {
      parents.push("unordered-list-item")
    } else if (
      node.type.name === "ordered_list" &&
      index < parentNodes.length - 1
    ) {
      parents.push("ordered-list-item")
    } else if (node.type.name === "paragraph") {
      parents.push("paragraph")
    } else if (node.type.name === "aside") {
      parents.push("aside")
    } else if (node.type.name === "blockquote") {
      parents.push("blockquote")
    }
  }
  return parents
}

export function* traverseSpans(
  amSpans: am.Span[],
): IterableIterator<TraversalEvent> {
  if (amSpans.length === 0) {
    return yield* [
      { type: "openTag", tag: "paragraph", role: "render-only" },
      { type: "closeTag", tag: "paragraph", role: "render-only" },
    ]
  }

  const spanQueue = amSpans.slice()

  function* inner(
    spans: am.Span[],
    enclosingBlock: BlockMetadata | null = null,
  ): IterableIterator<TraversalEvent> {
    let lastBlock: BlockMetadata | null = null

    while (spans.length > 0) {
      //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const span = spans.shift()!
      if (span.type === "text") {
        const textSpans = [
          { value: span.value, marks: span.marks },
          ...popTextSpans(spans),
        ]
        if (enclosingBlock == null) {
          yield { type: "openTag", tag: "paragraph", role: "render-only" }
        }
        for (const text of textSpans) {
          yield { type: "text", text: text.value, marks: text.marks || {} }
        }
        if (enclosingBlock == null) {
          yield { type: "closeTag", tag: "paragraph", role: "render-only" }
        }
      } else if (span.type === "block") {
        let subSpans: am.Span[] = []
        if (!span.value.attrs.isEmbed) {
          subSpans = popSpansBelow(span.value, spans)
        }

        const newBlocks = blockDiff({
          enclosing: enclosingBlock,
          previous: lastBlock,
          block: span.value,
          following: peekNextBlock(spans),
        })

        for (const block of newBlocks.toOpen) {
          if (block.openOuter) {
            yield* openOuterWrappers(block.block)
          }
          if (block.isParent) {
            yield* openBlock(block.block, true)
            // TODO: replace this with ContentMatch.fillBefore
            yield* fillBefore(block.block, block.containedBlock)
          } else {
            yield { type: "block", block: span.value }
            if (span.value.attrs.isEmbed) {
              yield { type: "leafNode", tag: span.value.type, role: "explicit" }
            } else {
              yield* openBlock(block.block, false)
            }
          }
        }

        if (subSpans.length == 0) {
          yield* openInnerWrappers(span.value.type, null)
          yield* closeInnerWrappers(span.value.type, null)
        } else {
          let lastBlock = null
          while (subSpans.length > 0) {
            const subNext = subSpans[0]
            if (subNext.type === "text") {
              const textSpans = popTextSpans(subSpans)
              const wrapping = findWrapping(span.value.type, lastBlock, subNext)
              if (wrapping == null)
                throw new Error(`wrapping not found for ${span.value.type}`)
              yield* wrapping.before
              for (const text of textSpans) {
                yield { type: "text", text: text.value, marks: text.marks }
              }
              yield* wrapping.after
            } else {
              // TODO replace this with ContentMatch.findWrapping
              const wrapping = findWrapping(span.value.type, lastBlock, subNext)
              if (wrapping == null)
                throw new Error(
                  `wrapping not found for ${subNext.value.type} inside ${span.value.type} following ${lastBlock}`,
                )
              yield* wrapping.before
              yield* inner(subSpans, span.value)
              yield* wrapping.after
            }
            lastBlock = subNext
          }
        }

        for (const block of newBlocks.toClose) {
          if (!block.isParent) {
            if (!span.value.attrs.isEmbed) {
              yield* closeBlock(block.block, false)
            }
          } else {
            yield* closeBlock(block.block, true)
          }
          if (block.closeOuter) {
            yield* closeOuterWrappers(block.block)
          }
        }
        lastBlock = span.value
      }
    }
  }
  yield* inner(spanQueue, null)
}

function peekNextBlock(spans: am.Span[]): BlockMetadata | null {
  for (const span of spans) {
    if (span.type === "block") {
      return span.value
    }
  }
  return null
}

function popTextSpans(
  spans: am.Span[],
): { value: string; marks: am.MarkSet }[] {
  const result = []
  while (spans.length > 0) {
    const next = spans[0]
    if (next.type === "text") {
      result.push({ value: next.value, marks: next.marks || {} })
      spans.shift()
    } else {
      break
    }
  }
  return result
}

function popSpansBelow(parent: BlockMetadata, spans: am.Span[]): am.Span[] {
  const result: am.Span[] = []
  const parentPath = [...parent.parents, parent.type]
  while (spans.length > 0) {
    const next = spans[0]
    if (next.type === "text") {
      //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result.push(spans.shift()!)
    } else {
      const nextPath = [...next.value.parents, next.value.type]
      if (
        commonPrefixLength(parentPath, nextPath) == parentPath.length &&
        nextPath.length > parentPath.length
      ) {
        //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        result.push(spans.shift()!)
      } else {
        break
      }
    }
  }
  return result
}

type BlockDiffArgs = {
  enclosing: BlockMetadata | null
  previous: BlockMetadata | null
  block: BlockMetadata
  following: BlockMetadata | null
}
type BlockDiff = {
  toOpen: {
    block: string
    isParent: boolean
    openOuter: boolean
    containedBlock: string | null
  }[]
  toClose: { block: string; isParent: boolean; closeOuter: boolean }[]
}
export function blockDiff({
  enclosing,
  previous,
  block,
  following,
}: BlockDiffArgs): BlockDiff {
  const enclosingPath = enclosing ? [...enclosing.parents, enclosing.type] : []
  const blockPath = [...block.parents, block.type]
  const previousPath = previous ? [...previous.parents, previous.type] : []
  const nextPath = following ? [...following.parents, following.type] : []

  const commonPrefix = commonPrefixLength(enclosingPath, blockPath)

  const previousToOpen = previousPath.slice(commonPrefix)
  const thisBlockToOpen = blockPath.slice(commonPrefix)

  let toOpenPrefix = commonPrefixLength(previousToOpen, thisBlockToOpen)
  const openingSibling =
    toOpenPrefix > 0 && thisBlockToOpen[toOpenPrefix - 1] !== "blockquote"
  if (openingSibling) {
    // we want to open sibling blocks, e.g.
    // {type: "paragraph", parents: []}
    // {type: "paragraph", parents: []}
    // should result in opening one <paragraph>
    //
    // However
    // {type: "heading", parents: ["blockquote"]}
    // {type: "paragraph", parents: ["blockquote"]}
    //
    // should _not_ result in two blockquote blocks a sibling block
    toOpenPrefix -= 1
  }
  const blocksToOpen = thisBlockToOpen
    .slice(toOpenPrefix)
    .map(block => ({ block, isParent: true, openOuter: true }))

  if (blocksToOpen.length > 0) {
    blocksToOpen[blocksToOpen.length - 1].isParent = false
  }
  if (openingSibling) {
    // We don't want to open the outer wrapper if we're opening a sibling block
    blocksToOpen[0].openOuter = false
  }

  const toOpen = []
  for (const [index, block] of blocksToOpen.entries()) {
    toOpen.push({
      ...block,
      containedBlock: blocksToOpen[index + 1]?.block || null,
    })
  }

  const nextToClose = nextPath.slice(commonPrefix)
  const thisBlockToClose = blockPath.slice(commonPrefix)
  let toClosePrefix = commonPrefixLength(nextToClose, thisBlockToClose)
  const closingSibling =
    toClosePrefix > 0 && thisBlockToClose[toClosePrefix - 1] !== "blockquote"
  //if (toClosePrefix > 0) {
  if (closingSibling) {
    // we want to close sibling blocks, e.g.
    //
    // block: {type: "paragraph", parents: []}
    // next: {type: "paragraph", parents: []}
    //
    // should result in closing one </paragraph>
    toClosePrefix -= 1
  }
  const toClose = thisBlockToClose
    .slice(toClosePrefix)
    .map(block => ({ block, isParent: true, closeOuter: true }))
  if (toClose.length > 0) {
    toClose[toClose.length - 1].isParent = false
  }
  if (closingSibling) {
    toClose[0].closeOuter = false
  }
  return { toOpen: toOpen, toClose: toClose.toReversed() }
}

function closeBlock(blockType: string, isParent: boolean): TraversalEvent[] {
  const role = isParent ? "render-only" : "explicit"
  if (
    blockType === "ordered-list-item" ||
    blockType === "unordered-list-item"
  ) {
    return [{ type: "closeTag", tag: "list-item", role }]
  } else if (blockType === "code-block") {
    return [{ type: "closeTag", tag: "code_block", role }]
  } else {
    return [{ type: "closeTag", tag: blockType, role }]
  }
}

function closeInnerWrappers(
  blockType: string,
  containedBlock: am.Span | null,
): TraversalEvent[] {
  if (
    blockType === "ordered-list-item" ||
    blockType === "unordered-list-item"
  ) {
    if (containedBlock == null || containedBlock.type === "text") {
      return [{ type: "closeTag", tag: "paragraph", role: "render-only" }]
    }
  }
  if (blockType === "aside") {
    if (containedBlock == null) {
      return [{ type: "closeTag", tag: "paragraph", role: "render-only" }]
    }
  }
  return []
}

function closeOuterWrappers(blockType: string): TraversalEvent[] {
  if (blockType === "ordered-list-item") {
    return [{ type: "closeTag", tag: "ordered-list", role: "render-only" }]
  } else if (blockType === "unordered-list-item") {
    return [{ type: "closeTag", tag: "unordered-list", role: "render-only" }]
  } else {
    return []
  }
}

function openOuterWrappers(blockType: string): TraversalEvent[] {
  if (blockType === "ordered-list-item") {
    return [{ type: "openTag", tag: "ordered-list", role: "render-only" }]
  } else if (blockType === "unordered-list-item") {
    return [{ type: "openTag", tag: "unordered-list", role: "render-only" }]
  } else {
    return []
  }
}

function openBlock(blockType: string, isParent: boolean): TraversalEvent[] {
  const role = isParent ? "render-only" : "explicit"
  if (
    blockType === "ordered-list-item" ||
    blockType === "unordered-list-item"
  ) {
    return [{ type: "openTag", tag: "list-item", role }]
  } else if (blockType === "code-block") {
    return [{ type: "openTag", tag: "code_block", role }]
  } else {
    return [{ type: "openTag", tag: blockType, role }]
  }
}

function fillBefore(
  containerType: string,
  containedBlockType: string | null,
): TraversalEvent[] {
  if (
    containerType === "ordered-list-item" ||
    containerType === "unordered-list-item"
  ) {
    if (containedBlockType == null || containedBlockType !== "paragraph") {
      return [
        { type: "openTag", tag: "paragraph", role: "render-only" },
        { type: "closeTag", tag: "paragraph", role: "render-only" },
      ]
    }
  }
  return []
}

function findWrapping(
  containerType: string,
  lastBlock: am.Span | null,
  block: am.Span,
): { before: TraversalEvent[]; after: TraversalEvent[] } | null {
  if (
    containerType === "ordered-list-item" ||
    containerType === "unordered-list-item"
  ) {
    if (block.type === "text") {
      return {
        before: [{ type: "openTag", tag: "paragraph", role: "render-only" }],
        after: [{ type: "closeTag", tag: "paragraph", role: "render-only" }],
      }
    } else if (block.type === "block") {
      if (block.value.type === "paragraph") {
        return {
          before: [],
          after: [],
        }
      }
      if (
        lastBlock != null &&
        ((lastBlock.type === "block" && lastBlock.value.type === "paragraph") ||
          lastBlock.type === "text")
      ) {
        return {
          before: [],
          after: [],
        }
      } else {
        return {
          before: [
            { type: "openTag", tag: "paragraph", role: "render-only" },
            { type: "closeTag", tag: "paragraph", role: "render-only" },
          ],
          after: [],
        }
      }
    }
  } else if (containerType === "aside") {
    if (block.type === "text") {
      return {
        before: [{ type: "openTag", tag: "paragraph", role: "render-only" }],
        after: [{ type: "closeTag", tag: "paragraph", role: "render-only" }],
      }
    } else {
      return {
        before: [],
        after: [],
      }
    }
  } else {
    return {
      before: [],
      after: [],
    }
  }
  return null
}

function openInnerWrappers(
  blockType: string,
  containedBlock: am.Span | null,
): TraversalEvent[] {
  if (
    blockType === "ordered-list-item" ||
    blockType === "unordered-list-item"
  ) {
    if (containedBlock == null || containedBlock.type === "text") {
      return [{ type: "openTag", tag: "paragraph", role: "render-only" }]
    }
  }
  if (blockType === "aside") {
    if (containedBlock == null) {
      return [{ type: "openTag", tag: "paragraph", role: "render-only" }]
    }
  }
  return []
}

export function pmRangeToAmRange(
  spans: am.Span[],
  { from, to }: { from: number; to: number },
): { start: number; end: number } | null {
  const events = eventsWithIndexChanges(traverseSpans(spans))
  let amStart = null
  let amEnd = null
  let maxPmIdxSeen = null
  let maxAmIdxSeen = null

  if (from === 0) {
    amStart = 0
  }

  while (
    maxPmIdxSeen == null ||
    maxPmIdxSeen <= to ||
    amStart == null ||
    amEnd == null
  ) {
    const next = events.next()
    if (next.done) {
      break
    }
    const state = next.value
    maxPmIdxSeen = state.after.pmIdx
    maxAmIdxSeen = state.after.amIdx

    if (amStart == null) {
      if (state.after.pmIdx < from) {
        continue
      }
      if (state.event.type === "text") {
        if (state.before.pmIdx > from) {
          // We already passed the start but this is the first automerge event
          // we've seen
          amStart = Math.max(state.before.amIdx, 0) + 1
        } else if (state.before.pmIdx + state.event.text.length > from) {
          // The target `from` is in the middle of this text
          const diff = from - state.before.pmIdx
          //amStart = Math.max(state.before.amIdx, 0) + diff + 1
          amStart = state.before.amIdx + diff + 1
        } else {
          amStart = Math.max(state.after.amIdx, 0) + 1
        }
      } else if (state.after.pmIdx >= from) {
        // we are only interested in blocks which start _after_ the from index
        amStart = state.after.amIdx + 1
      }
    }
    if (amEnd == null) {
      if (state.after.pmIdx < to) {
        continue
      }
      if (state.event.type === "text") {
        if (state.before.pmIdx >= to) {
          amEnd = state.before.amIdx + 1
        } else if (state.before.pmIdx + state.event.text.length > to) {
          const diff = to - state.before.pmIdx
          //amEnd = Math.max(state.before.amIdx, 0) + diff + 1
          amEnd = state.before.amIdx + diff + 1
        }
      } else {
        if (state.before.pmIdx > to) {
          amEnd = state.before.amIdx + 1
        }
      }
    }
  }

  if (amStart != null) {
    if (amEnd == null) {
      amEnd = maxAmIdxSeen ? maxAmIdxSeen + 1 : amStart
    }
    return { start: amStart, end: amEnd }
  } else {
    const endOfDoc = maxAmIdxSeen ? maxAmIdxSeen + 1 : 0
    return { start: endOfDoc, end: endOfDoc }
  }
}

function commonPrefixLength(a: string[], b: string[]): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++
  }
  return i
}

export function blockAtIdx(
  spans: am.Span[],
  target: number,
): { index: number; block: BlockMetadata } | null {
  let idx = 0
  let block: { index: number; block: BlockMetadata } | null = null
  for (const span of spans) {
    if (idx > target) {
      return block
    }
    if (span.type === "text") {
      if (idx + span.value.length > target) {
        return block
      }
      idx += span.value.length
    } else {
      if (isBlockMetadata(span.value)) {
        block = { index: idx, block: span.value }
      }
      idx += 1
    }
  }
  return block
}

export function blocksFromNode(node: Node): (
  | {
      type: string
      parents: string[]
      attrs: { [key: string]: BlockAttrValue }
    }
  | string
)[] {
  const events = traverseNode(node)
  const result: (
    | {
        type: string
        parents: string[]
        attrs: { [key: string]: BlockAttrValue }
      }
    | string
  )[] = []
  for (const event of events) {
    if (event.type == "block") {
      const attrs = { ...event.block.attrs }
      delete attrs.isAmgBlock
      result.push({
        type: event.block.type,
        parents: event.block.parents,
        attrs,
      })
    } else if (event.type == "text") {
      result.push(event.text)
    }
  }
  return result
}
