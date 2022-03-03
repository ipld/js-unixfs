import * as UnixFS from "../unixfs.js"
import { EMPTY, panic } from "../writer/util.js"

/**
 * @typedef {{
 * items: Array<UnixFS.FileLink|void> // Sparse array of items
 * offset: number // Current offset within a queue
 * }} Queue
 */

/**
 * @returns {Queue}
 */
export const empty = () => ({ items: [], offset: 0 })

/**
 * Adds an leaf at the given offest. If queue contains leaves in the head of
 * the queue they are returned as `leaves` array and are removed from the queue.
 *
 * @param {Queue} queue
 * @param {number} offset
 * @param {UnixFS.FileLink} item
 * @returns {Queue & {leaves: UnixFS.FileLink[]}}
 */
export const add = (queue, offset, item) => {
  // If item offset is greater than queues current offset we're still awaitng
  // on preceeding items so we simply store the new item returning new queue
  // and no leaves.
  if (offset > queue.offset) {
    const items = { ...queue.items }
    items[offset - queue.offset] = item
    return { items, offset: queue.offset, leaves: EMPTY }
  }
  // If this item is in the head of the queue so we can
  else if (offset === queue.offset) {
    let n = offset
    const { items } = queue
    const leaves = []
    const size = offset + items.length
    while (n < size) {
      const item = items[n]
      if (item != null) {
        leaves.push(item)
        n++
      } else {
        break
      }
    }
    return { items: items.slice(n), offset: n, leaves }
  }
  // This should never happen, yet we still handle the case by throwing in case
  // there is a bug somewhere.
  else {
    return panic(
      `Got queue item at ${offset}, while queue is already at ${queue.offset} offset`
    )
  }
}

/**
 * Resizes queue to a given size
 *
 * @param {Queue} queue
 * @param {number} size
 */
export const resize = (queue, size) => {
  const items = [...queue.items]
  items.length = size - queue.offset
  return { offset: queue.offset, items }
}

/**
 * @param {Queue} queue
 * @returns {number}
 */
export const size = queue => queue.offset + queue.items.length
