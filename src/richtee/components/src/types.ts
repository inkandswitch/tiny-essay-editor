import { next as am } from "@automerge/automerge"

export type BlockType = string

export type BlockMetadata = {
  type: BlockType
  parents: string[]
  attrs: { [key: string]: am.BlockAttrValue }
}

export function isBlockMetadata(obj: unknown): obj is BlockMetadata {
  if (obj == null) {
    return false
  }
  if (typeof obj !== "object") {
    return false
  }
  if (!("type" in obj) || typeof obj.type !== "string") {
    return false
  }
  if (!("parents" in obj) || !Array.isArray(obj.parents)) {
    return false
  }
  if (!validBlockType(obj.type)) {
    return false
  }
  for (const parent of obj.parents) {
    if (!validBlockType(parent)) {
      return false
    }
  }
  return true
}

export function validBlockType(type: unknown): type is BlockType {
  if (!(typeof type === "string")) {
    return false
  }
  return [
    "ordered-list-item",
    "unordered-list-item",
    "paragraph",
    "heading",
    "aside",
  ].includes(type)
}
