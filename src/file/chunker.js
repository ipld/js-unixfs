import * as BufferQueue from "./chunker/buffer.js"
import * as Chunker from "./chunker/api.js"
import { EMPTY } from "../writer/util.js"
export * from "./chunker/api.js"

/**
 * @typedef {{
 * chunker: Chunker.Chunker
 * }} Config
 *
 *
 * @typedef {{
 * buffer: BufferQueue.View
 * config: Config
 * }} Chunker
 *
 * @typedef {Chunker & {chunks: Chunker.Chunk[]}} ChunkerWithChunks
 */

/**
 * @param {Config} config
 * @returns {Chunker}
 */
export const open = config => ({
  config,
  buffer: BufferQueue.empty(),
})

/**
 * @param {Chunker} state
 * @param {Uint8Array} bytes
 * @returns {ChunkerWithChunks}
 */
export const write = (state, bytes) =>
  bytes.byteLength > 0
    ? split(state.config, state.buffer.push(bytes), false)
    : { ...state, chunks: EMPTY }

/**
 * @param {Chunker} state
 * @returns {ChunkerWithChunks}
 */
export const close = state => split(state.config, state.buffer, true)

/**
 * @param {Config} config
 * @param {BufferQueue.View} buffer
 * @param {boolean} end
 * @returns {ChunkerWithChunks}
 */

export const split = (config, buffer, end) => {
  const chunker = config.chunker
  const chunks = []

  let offset = 0
  for (const size of chunker.cut(chunker.context, buffer, end)) {
    // We may be splitting empty buffer in which case there will be no chunks
    // in it so we make sure that we do not emit empty buffer.
    if (size > 0) {
      const chunk = buffer.subarray(offset, offset + size)
      chunks.push(chunk)
      offset += size
    }
  }

  return { config, chunks, buffer: buffer.subarray(offset) }
}
