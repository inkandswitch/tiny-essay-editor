import { NodeSpec, Schema, DOMOutputSpec, MarkSpec } from "prosemirror-model"

function addIsAmgBlockAttr(nodes: { [key: string]: NodeSpec }): {
  [key: string]: NodeSpec
} {
  for (const [_, node] of Object.entries(nodes)) {
    if (node.content) {
      node.attrs
        ? (node.attrs.isAmgBlock = { default: false })
        : (node.attrs = { isAmgBlock: { default: false } })
    }
  }
  return nodes
}

// basics
const pDOM: DOMOutputSpec = ["p", 0]
const blockquoteDOM: DOMOutputSpec = ["blockquote", 0]
const hrDOM: DOMOutputSpec = ["hr"]
const preDOM: DOMOutputSpec = ["pre", ["code", 0]]

// marks
const emDOM: DOMOutputSpec = ["em", 0]
const strongDOM: DOMOutputSpec = ["strong", 0]
const codeDOM: DOMOutputSpec = ["code", 0]

// lists
const olDOM: DOMOutputSpec = ["ol", 0]
const ulDOM: DOMOutputSpec = ["ul", 0]
const liDOM: DOMOutputSpec = ["li", 0]

export const schema = new Schema({
  nodes: addIsAmgBlockAttr({
    /// NodeSpec The top level document node.
    doc: {
      content: "block+",
    } as NodeSpec,

    /// A plain paragraph textblock. Represented in the DOM
    /// as a `<p>` element.
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return pDOM
      },
    } as NodeSpec,

    /// A blockquote (`<blockquote>`) wrapping one or more blocks.
    blockquote: {
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM() {
        return blockquoteDOM
      },
    } as NodeSpec,

    /// A horizontal rule (`<hr>`).
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM() {
        return hrDOM
      },
    } as NodeSpec,

    /// A heading textblock, with a `level` attribute that
    /// should hold the number 1 to 6. Parsed and serialized as `<h1>` to
    /// `<h6>` elements.
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } },
      ],
      toDOM(node) {
        return ["h" + node.attrs.level, 0]
      },
    } as NodeSpec,

    /// A code listing. Disallows marks or non-text inline
    /// nodes by default. Represented as a `<pre>` element with a
    /// `<code>` element inside of it.
    code_block: {
      content: "text*",
      marks: "",
      group: "block",
      code: true,
      defining: true,
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }],
      toDOM() {
        return preDOM
      },
    } as NodeSpec,

    /// The text node.
    text: {
      group: "inline",
    } as NodeSpec,

    /// An inline image (`<img>`) node. Supports `src`,
    /// `alt`, and `href` attributes. The latter two default to the empty
    /// string.
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      group: "inline",
      draggable: true,
      parseDOM: [
        {
          tag: "img[src]",
          getAttrs(dom: HTMLElement) {
            return {
              src: dom.getAttribute("src"),
              title: dom.getAttribute("title"),
              alt: dom.getAttribute("alt"),
            }
          },
        },
      ],
      toDOM(node) {
        const { src, alt, title } = node.attrs
        return ["img", { src, alt, title }]
      },
    } as NodeSpec,

    ordered_list: {
      group: "block",
      content: "list_item+",
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: "ol",
          getAttrs(dom: HTMLElement) {
            return {
              order: dom.hasAttribute("start")
                ? +dom.getAttribute("start")!
                : 1,
            }
          },
        },
      ],
      toDOM(node) {
        return node.attrs.order == 1
          ? olDOM
          : ["ol", { start: node.attrs.order }, 0]
      },
    } as NodeSpec,

    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM() {
        return ulDOM
      },
    },

    /// A list item (`<li>`) spec.
    list_item: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM() {
        return liDOM
      },
      defining: true,
    },

    aside: {
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "aside" }],
      toDOM() {
        return ["aside", 0]
      },
    },
  }),
  marks: {
    /// A link. Has `href` and `title` attributes. `title`
    /// defaults to the empty string. Rendered and parsed as an `<a>`
    /// element.
    link: {
      attrs: {
        href: {},
        title: { default: null },
      },
      inclusive: false,
      parseDOM: [
        {
          tag: "a[href]",
          getAttrs(dom: HTMLElement) {
            return {
              href: dom.getAttribute("href"),
              title: dom.getAttribute("title"),
            }
          },
        },
      ],
      toDOM(node) {
        const { href, title } = node.attrs
        return ["a", { href, title }, 0]
      },
    } as MarkSpec,

    /// An emphasis mark. Rendered as an `<em>` element. Has parse rules
    /// that also match `<i>` and `font-style: italic`.
    em: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" },
        { style: "font-style=normal", clearMark: m => m.type.name == "em" },
      ],
      toDOM() {
        return emDOM
      },
    } as MarkSpec,

    /// A strong mark. Rendered as `<strong>`, parse rules also match
    /// `<b>` and `font-weight: bold`.
    strong: {
      parseDOM: [
        { tag: "strong" },
        // This works around a Google Docs misbehavior where
        // pasted content will be inexplicably wrapped in `<b>`
        // tags with a font-weight normal.
        {
          tag: "b",
          getAttrs: (node: HTMLElement) =>
            node.style.fontWeight != "normal" && null,
        },
        { style: "font-weight=400", clearMark: m => m.type.name == "strong" },
        {
          style: "font-weight",
          getAttrs: (value: string) =>
            /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM() {
        return strongDOM
      },
    } as MarkSpec,

    /// Code font mark. Represented as a `<code>` element.
    code: {
      parseDOM: [{ tag: "code" }],
      toDOM() {
        return codeDOM
      },
    } as MarkSpec,
  },
})
