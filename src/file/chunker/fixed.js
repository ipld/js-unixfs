import * as API from "./api.js"

export const name = "fixed"
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
  name,
  cut,
})

/**
 * @param {FixedSize} maxChunkSize
 * @param {API.Chunk} buffer
 * @param {boolean} end
 * @returns {number[]}
 */
export const cut = ({ maxChunkSize }, { byteLength }, end) => {
  // number of fixed size chunks that would fit
  const n = (byteLength / maxChunkSize) | 0
  const chunks = new Array(n).fill(maxChunkSize)
  const lastChunkSize = end ? byteLength - n * maxChunkSize : 0
  if (lastChunkSize > 0) {
    chunks.push(lastChunkSize)
  }
  return chunks
}
