/* eslint-disable no-nested-ternary */
/* eslint-disable no-unused-vars */
import * as Chunker from "./chunker/api.js"
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
 * buffer: Uint8Array
 * }} EmptyState
 * Represents empty state where no chunks have been found yet.
 *
 * @typedef {{
 * status: 'single'
 * config: Config
 * buffer: Uint8Array
 * chunk: Uint8Array
 * }} SingleChunkState
 * Represents state where single chunk have been found. In this
 * state it is not yet clear which file layout can be used, because
 * since chunk files maybe encoded as raw blocks, or file blocks.
 *
 * @typedef {{
 * status: 'multiple'
 * config: Config
 * buffer: Uint8Array
 * }} MultiChunkState
 * Represents state where more than one chunks have been found.
 *
 * @typedef {EmptyState|SingleChunkState|MultiChunkState} State
 *
 * @typedef {{
 * state: State
 * chunks: Uint8Array[]
 * }} Update
 */

/**
 * @param {Config} config
 * @returns {State}
 */
export const open = config => ({
  config,
  status: "none",
  buffer: EMPTY_BUFFER,
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
  const { buffer, chunks } = split(concat(state.buffer, bytes), config.chunker)
  switch (state.status) {
    case "none":
      switch (chunks.length) {
        case 0:
          return {
            state: { ...state, buffer },
            chunks: EMPTY,
          }
        case 1:
          return {
            state: { ...state, status: "single", buffer, chunk: chunks[0] },
            chunks: EMPTY,
          }
        default:
          return {
            state: { ...state, status: "multiple", buffer },
            chunks,
          }
      }
    case "single":
      if (chunks.length === 0) {
        return { state: { ...state, buffer }, chunks: EMPTY }
      } else {
        const { chunk, ...rest } = state
        return {
          state: { ...rest, status: "multiple", buffer },
          chunks: [chunk, ...chunks],
        }
      }
    case "multiple":
      return {
        state: { ...state, buffer },
        chunks,
      }
    default:
      return unreachable`Unexpected ChunkerState ${state}`
  }
}

/**
 * @param {State} state
 * @returns {{single: true, chunk:Uint8Array}|{single: false, chunks: Uint8Array[]}}
 */
export const close = state => {
  const { buffer } = state
  switch (state.status) {
    case "none":
      return {
        single: true,
        chunk: buffer,
      }
    case "single": {
      if (buffer.byteLength > 0) {
        return {
          single: false,
          chunks: [state.chunk, buffer],
        }
      } else {
        return { single: true, chunk: state.chunk }
      }
    }
    case "multiple": {
      return {
        single: false,
        chunks: buffer.byteLength > 0 ? [buffer] : EMPTY,
      }
    }
    default:
      return unreachable`Unexpected chunker state ${state}`
  }
}

/**
 * @param {Chunker.Chunker} chunker
 * @param {Uint8Array} input
 * @returns {{buffer:Uint8Array, chunks:Uint8Array[]}}
 */

export const split = (input, chunker) => {
  let buffer = input
  /** @type {Uint8Array[]} */
  const chunks = []
  const sizes = chunker.cut(chunker.context, buffer)
  let offset = 0
  for (const size of sizes) {
    const chunk = buffer.subarray(offset, offset + size)
    chunks.push(chunk)
    offset += size
  }
  buffer = buffer.subarray(offset)

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
