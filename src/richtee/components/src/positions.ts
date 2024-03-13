import { BLOCK_MARKER } from "./constants"
import { Node, NodeType } from "prosemirror-model"

export function amIdxToPmIdx(amIdx: number, amText: string): number {
  // first, count how many paragraphs we have
  let idx = amText.indexOf(BLOCK_MARKER)
  let i = 0
  while (idx < amIdx && idx !== -1) {
    idx = amText.indexOf(BLOCK_MARKER, idx + 1)
    i++
  }

  // this is how many blocks precede the current one.
  // BtextBmore textBmo^re text after pos
  const automergeBlockCount = i

  // <p>text</p><p>more text</p><p>mo^re text after pos</p>
  const prosemirrorBlockCount = automergeBlockCount * 2

  const diff = prosemirrorBlockCount - automergeBlockCount
  return amIdx + diff + 1 // +1 for the opening paragraph tag
}

export function pmIdxToAmIdx(position: number, pmDoc: Node): number {
  // Convert prosemirror positions to positions in an automerge text field
  //
  // Text in automerge is stored a sequence of text characters with blocks
  // delimited by a special `splitBlock` character. Prosemirror indices on the
  // other hand are incremented on entering and leaving a block. If we had a
  // simple flat list of blocks then this would be a straightforward
  // conversion, we would walk through the text of the node, adding one to the
  // index for each character we encounter and for each opening block (but
  // not closing block) that we encounter. For example
  //
  // <doc>
  // <p>text</p>
  // <p>more text</p>
  // </doc>
  //
  // Would mean the following actions
  //
  // .-----------------------------------------.
  // | Character | Action | Automerge Position |
  // -------------------------------------------
  // | <doc>     | ignore | 0                  |
  // | <p>       | +1     | 1                  |
  // | text      | +4     | 5                  |
  // | </p>      | ignore | 5                  |
  // | <p>       | +1     | 6                  |
  // | more text | +9     | 15                 |
  // | </p>      | ignore | 15                 |
  // | </doc>    | ignore | 15                 |
  // '-----------------------------------------'
  //
  // And if we imagine the automerge document represented like so:
  //
  // <splitBlock type="p">
  // text
  // <splitBlock type="p">
  // more text
  //
  // Then we can see that the length of the automerge document is 15, and if
  // we were looking up e.g. the 10th character then it would point at the
  // first 'e' in 'more text'.
  //
  // Things are more complex than this though. Our documents consist of nested
  // blocks and Prosemirror and Automerge represent these in very different
  // ways. In Prosemirror nested blocks are represented directly as nested
  // tags. For example, a nested list structure looks like this:
  //
  // <doc>
  // <ul>
  //  <li>item 1</li>
  //  <li>
  //    <ol>
  //    <li>item 2</li>
  //    <li>item 3</li>
  //    </ol>
  //  </li>
  // </ul>
  //
  // Automerge on the other hand represents nested structures using the
  // "parents" property of the splitblock marker. The nested structure above
  // would be represented like this:
  //
  // <splitBlock type="unordered-list-item">
  // item 1
  // <splitBlock type="ordered-list-item" parents=["unordered-list-item"]>
  // item 2
  // <splitBlock type="ordered-list-item" parents=["unordered-list-item"]>
  // item 3
  //
  // The splitblock markers are inserted for the immediate containers of the
  // text which follows. In the example above there are no markers for the
  // intermediate <ul> and <ol> tags, only for the <li> tags.
  //
  // To get the automerge indices then perform a pre-order traversal of the
  // Node passed to us. We increment the automerge index for each character
  // in leaf nodes and for each descent into a child node for internal nodes.
  // When we encounter a node which should be the target of a splitblock
  // operation we decrement the index by the number of inferred parents of the
  // given target if the node we are looking at is the first child of it's
  // parent. For example, given the following structure
  //
  // <doc>
  // <ul>
  //   <li>item 1</li>
  //   <li>
  //      <ol>
  //        <li>item 2</li>
  //        <li>item 3</li>
  //      </ol>
  //   </li>
  // </ul>
  // </doc>
  //
  // We would expect the following actions
  //
  // .------------------------------------------.
  // | Character | Action  | Automerge Position |
  // --------------------------------------------
  // | <doc>     | ignore  | 0                  |
  // | <ul>      | +1      | 1                  |
  // | <li>      | (+1, -1)| 1                  |
  // | item 1    | +6      | 7                  |
  // | </li>     | ignore  | 13                 |
  // | <li>      | +1      | 14                 |
  // | <ol>      | +1      | 15                 |
  // | <li>      | (+1, -1)| 15                 |
  // | item 2    | +6      | 21                 |
  // | </li>     | ignore  | 21                 |
  // | <li>      | +1      | 22                 |
  // | item 3    | +6      | 28                 |
  // | </li>     | ignore  | 0                  |
  // | </ol>     | ignore  | 0                  |
  // | </li>     | ignore  | 0                  |
  // | </ul>     | ignore  | 0                  |
  // | </doc>    | ignore  | 0                  |
  // '------------------------------------------'

  const inferredParentCounts: { [elemType: string]: number } = {
    li: 1,
    p: 0,
  }

  let pmIdx = 0
  let automergeIdx = 0
  type NodeToProcess = { node: Node; isFirstChild: boolean }
  const toProcess: NodeToProcess[] = [{ node: pmDoc, isFirstChild: true }]
  while (toProcess.length > 0 && pmIdx < position) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { node, isFirstChild } = toProcess.pop()!
    pmIdx += 1
    if (node.isText) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      automergeIdx += node.text!.length
    } else if (node.isBlock) {
      if (node.type.name !== "doc") {
        automergeIdx += 1
      }
      if (!isFirstChild) {
        automergeIdx -= inferredParentCounts[node.type.name] || 0
      }

      // Push the children on the stack, but tag the first one with isFirstChild: true
      if (node.content.childCount > 0) {
        toProcess.push({ node: node.child(0), isFirstChild: true })
      }
      if (node.content.childCount > 1) {
        for (let i = 1; i < node.content.childCount; i++) {
          toProcess.push({ node: node.child(i), isFirstChild: false })
        }
      }
    }
  }
  return automergeIdx
}
