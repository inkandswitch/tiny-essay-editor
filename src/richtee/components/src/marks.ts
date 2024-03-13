import { Attrs } from "prosemirror-model"

/**
 * The value of a mark, including null which is only passed when removing a mark (i.e. in a mark patch)
 */
export type MarkValue = PresentMarkValue | null

/**
 * The value of a mark, excluding null
 *
 * @remarks
 *
 * The value of a mark is only ever null when we are removing a mark. `PresentMarkValue`
 * then is just a convenience type for when we are processing marks which we know
 * must be present (as for example in a insert or splice patch)
 */
export type PresentMarkValue = string | number | boolean | Date | Uint8Array

/**
 * How to map between mark values in automerge and mark values in prosemirror
 *
 * @remarks Marks in Prosemirror have a name and attributes. Attributes are
 * arbitrary javascript values. Marks in Automerge are almost the same, but
 * not quite. Automerge marks have a name and a value too, but the value is
 * a primitive value, not an object. This means that if you want to store
 * an object as a mark value in automerge you need to put the value somewhere
 * else in the document and refer to it somehow.
 *
 * @example
 * Consider marks representing comments. The comments will be represented in
 * automerge as a map with a key for each comment and the value of the mark
 * will have the ID of the comment (the key in the comments map) as it's value.
 *
 * ```ts
 * const commentsMarkMap = {
 *      createMark(doc: Extend<T>, markName: string, value: Attrs): MarkValue | null {
 *           const commentId = "1234" // here you would generate a random ID
 *           doc.comments[commentId] = { text: attrs.text } // Assuming that the text attribute is set by the editor somehow
 *           return commentId
 *      },
 *      loadMark(doc: T, markName: string, markValue: MarkValue): Attrs | null {
 *           const comment = doc.comments[markValue]
 *           if (comment == null) {
 *                return null
 *           } else {
 *               return { comment: comment.text }
 *           }
 *      }
 * }
 * ```
 */
export type MarkMap<T> = {
  /**
   * Create a mark in an automerge document from a mark created in the editor
   *
   * @param doc The automerge document to create the mark in
   * @param markName The name of the mark to create
   * @param value The attributes of the mark which was created by the user in the editor
   *
   * @typeParam T The type of the automerge document
   */
  createMark(doc: T, markName: string, value: Attrs): PresentMarkValue | null

  /**
   * Create a prosemirror mark from a mark in an automerge document
   *
   * @param doc The automerge document to load the mark from
   * @param markName The name of the mark to load
   * @param markValue The value of the mark in the automerge document
   *
   * @typeParam T The type of the automerge document
   */
  loadMark(doc: T, markName: string, markValue: PresentMarkValue): Attrs | null
}

export function defaultMarkMap<T>(): MarkMap<T> {
  return {
    createMark<T>(
      _doc: T,
      _markName: string,
      _value: Attrs,
    ): PresentMarkValue | null {
      return true
    },
    loadMark<T>(
      _doc: T,
      _markName: string,
      _markValue: PresentMarkValue,
    ): Attrs | null {
      return null
    },
  }
}
