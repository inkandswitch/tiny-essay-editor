import { TLRecord, RecordId, TLStore } from "@tldraw/tldraw"
import * as Automerge from "@automerge/automerge/next"

export function applyAutomergePatchesToTLStore(
  patches: Automerge.Patch[],
  store: TLStore
) {
  const toRemove: TLRecord["id"][] = []
  const updatedObjects: { [id: string]: TLRecord } = {}

  patches.forEach((patch) => {
    if (!isStorePatch(patch)) return

    const id = pathToId(patch.path)
    const record =
      updatedObjects[id] || JSON.parse(JSON.stringify(store.get(id) || {}))

    switch (patch.action) {
      case "insert": {
        updatedObjects[id] = applyInsertToObject(patch, record)
        break
      }
      case "put":
        updatedObjects[id] = applyPutToObject(patch, record)
        break
      case "update": {
        updatedObjects[id] = applyUpdateToObject(patch, record)
        break
      }
      case "splice": {
        updatedObjects[id] = applySpliceToObject(patch, record)
        break
      }
      case "del": {
        const id = pathToId(patch.path)
        toRemove.push(id as TLRecord["id"])
        break
      }
      default: {
        console.log("Unsupported patch:", patch)
      }
    }
  })
  const toPut = Object.values(updatedObjects)

  // put / remove the records in the store
  console.log({ patches, toPut })
  store.mergeRemoteChanges(() => {
    if (toRemove.length) store.remove(toRemove)
    if (toPut.length) store.put(toPut)
  })
}

const isStorePatch = (patch: Automerge.Patch): boolean => {
  return patch.path[0] === "store" && patch.path.length > 1
}

// path: ["store", "camera:page:page", "x"] => "camera:page:page"
const pathToId = (path: string[]): RecordId<any> => {
  return path[1] as RecordId<any>
}

const applyInsertToObject = (patch: Automerge.Patch, object: any): TLRecord => {
  const { path, values } = patch
  let current = object
  const insertionPoint = path[path.length - 1]
  const pathEnd = path[path.length - 2]
  const parts = path.slice(2, -2)
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
  }
  // splice is a mutator... yay.
  const clone = current[pathEnd].slice(0)
  clone.splice(insertionPoint, 0, ...values)
  current[pathEnd] = clone
  return object
}

const applyPutToObject = (patch: Automerge.Patch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  // special case
  if (path.length === 2) {
    // this would be creating the object, but we have done
    return object
  }

  const parts = path.slice(2, -2)
  const property = path[path.length - 1]
  const target = path[path.length - 2]

  if (path.length === 3) {
    return { ...object, [property]: value }
  }

  // default case
  for (const part of parts) {
    current = current[part]
  }
  current[target] = { ...current[target], [property]: value }
  return object
}

const applyUpdateToObject = (patch: Automerge.Patch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  const parts = path.slice(2, -1)
  const pathEnd = path[path.length - 1]
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
  }
  current[pathEnd] = value
  return object
}

const applySpliceToObject = (patch: Automerge.Patch, object: any): TLRecord => {
  const { path, value } = patch
  let current = object
  const insertionPoint = path[path.length - 1]
  const pathEnd = path[path.length - 2]
  const parts = path.slice(2, -2)
  for (const part of parts) {
    if (current[part] === undefined) {
      throw new Error("NO WAY")
    }
    current = current[part]
  }
  // TODO: we're not supporting actual splices yet because TLDraw won't generate them natively
  if (insertionPoint !== 0) {
    throw new Error("Splices are not supported yet")
  }
  current[pathEnd] = value // .splice(insertionPoint, 0, value)
  return object
}
