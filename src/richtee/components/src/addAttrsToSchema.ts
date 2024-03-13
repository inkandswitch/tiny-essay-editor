import { NodeSpec, type Schema } from "prosemirror-model"
import OrderedMap from "orderedmap"

export default function addAttrsToSchema(
  nodes: OrderedMap<NodeSpec>,
): OrderedMap<NodeSpec> {
  let result = nodes
  nodes.forEach((name, node) => {
    if (node.content) {
      result = result.update(
        name,
        add(node, { attrs: { isAmgBlock: { default: false }, ...node.attrs } }),
      )
    }
  })
  return result
}

function add(obj: { [prop: string]: any }, props: { [prop: string]: any }) {
  //eslint-disable-next-line
  let copy: { [prop: string]: any } = {}
  for (const prop in obj) copy[prop] = obj[prop]
  for (const prop in props) copy[prop] = props[prop]
  return copy
}
