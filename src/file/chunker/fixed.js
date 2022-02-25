// eslint-disable-next-line no-unused-vars
import * as API from "./api.js"

/**
 * @typedef {Object} FixedSize
 * @property {number} maxChunkSize
 */

/** @type {FixedSize} */
export const context = {
  maxChunkSize: 262144,
}

export const type = "Stateless"

/**
 * @param {number} maxChunkSize
 * @returns {API.StatelessChunker<FixedSize>}
 */
export const withMaxChunkSize = maxChunkSize => ({
  type: "Stateless",
  context: { maxChunkSize },
  cut,
})

/**
 * @param {FixedSize} maxChunkSize
 * @param {Uint8Array} buffer
 * @returns {number[]}
 */
export const cut = ({ maxChunkSize }, { byteLength }) => {
  // number of fixed size chunks that would fit
  const n = (byteLength / maxChunkSize) | 0
  return new Array(n).fill(maxChunkSize)
}
