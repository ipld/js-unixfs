import * as Chunker from "./chunker/api.js"
import * as BufferQueue from "./chunker/buffer.js"
import { unreachable, EMPTY, EMPTY_BUFFER } from "../writer/util.js"
export * from "./chunker/api.js"

/**
 * @typedef {{
 * chunker: Chunker.Chunker
 * }} Config
 *
 * @typedef {{
 * status: 'none'
 * config: Config
 * buffer: Chunker.Chunk
 * byteOffset: number
 * }} EmptyState
 * Represents empty state where no chunks have been found yet.
 *
 * @typedef {{
 * status: 'single'
 * byteOffset: number
 * config: Config
 * buffer: Chunker.Chunk
 * chunk: Chunker.Chunk
 * }} SingleChunkState
 * Represents state where single chunk have been found. In this
 * state it is not yet clear which file layout can be used, because
 * since chunk files maybe encoded as raw blocks, or file blocks.
 *
 * @typedef {{
 * status: 'multiple'
 * byteOffset: number
 * config: Config
 * buffer: Chunker.Chunk
 * }} MultiChunkState
 * Represents state where more than one chunks have been found.
 *
 * @typedef {EmptyState|SingleChunkState|MultiChunkState} State
 *
 * @typedef {{
 * state: State
 * chunks: Chunker.Chunk[]
 * }} Update
 */

/**
 * @param {Config} config
 * @returns {State}
 */
export const open = config => ({
  config,
  byteOffset: 0,
  status: "none",
  buffer: BufferQueue.empty(),
})

/**
 * @param {Update} update
 */
export const state = update => update.state

/**
 * @param {Update} update
 */
export const chunks = update => update.chunks

/**
 * @param {State} state
 * @param {Uint8Array} bytes
 * @returns {Update}
 */
export const append = (state, bytes) => {
  const { config } = state
  const byteOffset = state.byteOffset + bytes.byteLength
  const { buffer, chunks } = split(
    state.buffer.push(bytes),
    // concat(state.buffer, bytes),
    config.chunker,
    state.byteOffset,
    false
  )

  switch (state.status) {
    case "none":
      switch (chunks.length) {
        case 0:
          return {
            state: { ...state, byteOffset, buffer },
            chunks: EMPTY,
          }
        case 1:
          return {
            state: {
              ...state,
              status: "single",
              byteOffset,
              buffer,
              chunk: chunks[0],
            },
            chunks: EMPTY,
          }
        default:
          return {
            state: { ...state, status: "multiple", byteOffset, buffer },
            chunks,
          }
      }
    case "single":
      if (chunks.length === 0) {
        return { state: { ...state, buffer, byteOffset }, chunks: EMPTY }
      } else {
        const { chunk, ...rest } = state
        return {
          state: { ...rest, status: "multiple", byteOffset, buffer },
          chunks: [chunk, ...chunks],
        }
      }
    case "multiple":
      return {
        state: { ...state, byteOffset, buffer },
        chunks,
      }
    default:
      return unreachable`Unexpected ChunkerState ${state}`
  }
}

/**
 * @param {State} state
 * @returns {{single: true, chunk:Chunker.Chunk}|{single: false, chunks: Chunker.Chunk[]}}
 */
export const close = state => {
  const { buffer, config } = state
  // flush remaining bytes in the buffer
  const { chunks } = split(buffer, config.chunker, state.byteOffset, true)

  switch (state.status) {
    case "none": {
      return chunks.length <= 1
        ? { single: true, chunk: buffer }
        : { single: false, chunks }
    }
    case "single": {
      return chunks.length === 0
        ? { single: true, chunk: state.chunk }
        : { single: false, chunks: [state.chunk, ...chunks] }
    }
    case "multiple": {
      return {
        single: false,
        chunks,
      }
    }
    default:
      return unreachable`Unexpected chunker state ${state}`
  }
}

/**
 * @param {Chunker.Chunker} chunker
 * @param {Chunker.Chunk} input
 * @param {number} byteOffset
 * @param {boolean} end
 * @returns {{buffer:Chunker.Chunk, chunks:Chunker.Chunk[]}}
 */

export const split = (input, chunker, byteOffset, end) => {
  let buffer = input
  /** @type {Chunker.Chunk[]} */
  const chunks = []
  const sizes =
    chunker.type === "Stateful"
      ? chunker.cut(chunker.context, buffer.subarray(byteOffset), end)
      : chunker.cut(chunker.context, buffer, end)

  let offset = 0
  for (const size of sizes) {
    // We may be splitting empty buffer in which case there will be no chunks
    // in it so we make sure that we do not emit empty buffer.
    if (size > 0) {
      const chunk = buffer.subarray(offset, offset + size)
      chunks.push(chunk)
      offset += size
    }
  }
  buffer =
    offset === buffer.byteLength
      ? buffer
      : offset === 0
      ? buffer
      : buffer.subarray(offset)

  return { buffer, chunks }
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 */
export const concat = (left, right) => {
  if (left.byteLength === 0) {
    return right
  } else if (right.byteLength === 0) {
    return left
  } else {
    const join = new Uint8Array(left.byteLength + right.byteLength)
    join.set(left, 0)
    join.set(right, left.byteLength)
    return join
  }
}
