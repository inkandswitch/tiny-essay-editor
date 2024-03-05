import { RecordsDiff, TLRecord } from "@tldraw/tldraw"
import _ from "lodash"

export function applyTLStoreChangesToAutomerge(
  doc: any,
  changes: RecordsDiff<TLRecord>
) {
  Object.values(changes.added).forEach((record) => {
    doc.store[record.id] = record
  })

  Object.values(changes.updated).forEach(([_, record]) => {
    deepCompareAndUpdate(doc.store[record.id], record)
  })

  Object.values(changes.removed).forEach((record) => {
    delete doc.store[record.id]
  })
}

function deepCompareAndUpdate(objectA: any, objectB: any) {
  // eslint-disable-line
  if (_.isArray(objectB)) {
    if (!_.isArray(objectA)) {
      // if objectA is not an array, replace it with objectB
      objectA = objectB.slice()
    } else {
      // compare and update array elements
      for (let i = 0; i < objectB.length; i++) {
        if (i >= objectA.length) {
          objectA.push(objectB[i])
        } else {
          if (_.isObject(objectB[i]) || _.isArray(objectB[i])) {
            // if element is an object or array, recursively compare and update
            deepCompareAndUpdate(objectA[i], objectB[i])
          } else if (objectA[i] !== objectB[i]) {
            // update the element
            objectA[i] = objectB[i]
          }
        }
      }
      // remove extra elements
      if (objectA.length > objectB.length) {
        objectA.splice(objectB.length)
      }
    }
  } else if (_.isObject(objectB)) {
    _.forIn(objectB, (value: any, key: any) => {
      if (objectA[key] === undefined) {
        // if key is not in objectA, add it
        objectA[key] = value
      } else {
        if (_.isObject(value) || _.isArray(value)) {
          // if value is an object or array, recursively compare and update
          deepCompareAndUpdate(objectA[key], value)
        } else if (objectA[key] !== value) {
          // update the value
          objectA[key] = value
        }
      }
    })
    _.forIn(objectA, (_: any, key: string) => {
      if ((objectB as any)[key] === undefined) {
        // if key is not in objectB, remove it
        delete objectA[key]
      }
    })
  }
}
