import * as UnixFS from "../../../src/unixfs.js"
import * as Queue from "../../../src/file/layout/queue.js"

/**
 * @param {string} id
 * @returns {UnixFS.Link}
 */
export const createCID = id =>
  // @ts-expect-error - we just mock CID here
  ({ "/": id })

/**
 *
 * @param {string} name
 * @param {number} size
 * @param {number} dagSize
 * @returns {Queue.Link}
 */
export const createLink = (
  name,
  size = 120,
  dagSize = Math.floor(size + (size * 15) / 100)
) => ({
  cid: createCID(name),
  contentByteLength: size,
  dagByteLength: dagSize,
})

/**
 * Returns given ops in every possible order.
 *
 * @template T
 * @param {T[]} ops
 */
export function* shuffle(ops) {
  let offest = 0
  while (offest < ops.length) {
    const item = ops[offest]
    const rest = [...ops.slice(0, offest), ...ops.slice(offest + 1)]
    let n = 0
    while (n <= rest.length) {
      if (n != offest || offest == 0) {
        yield [...rest.slice(0, n), item, ...rest.slice(n)]
      }

      n++
    }

    offest++
  }
}

/**
 * @param {number} id
 * @param {Queue.Link[]} [links]
 * @returns {Queue.LinkedNode}
 */
export const createNode = (id, links = []) => ({
  id,
  links,
})
