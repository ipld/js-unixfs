import { File } from "@web-std/file"
import { CID } from "multiformats"
import fetch from "@web-std/fetch"
import { sha256 } from "multiformats/hashes/sha2"

const utf8Encoder = new TextEncoder()

/**
 * @param {string} input
 */
export const encodeUTF8 = input => utf8Encoder.encode(input)

/**
 * Utility function to generate deterministic garbage by hashing seed input,
 * then recursively hashing the product until total number of bytes yield
 * reaches `byteLength` (by default it is inifinity).
 *
 * @param {object} [options]
 * @param {Uint8Array} [options.seed]
 * @param {number} [options.byteLength]
 */
export async function* hashrecur({
  seed = encodeUTF8("hello world"),
  byteLength = Infinity,
} = {}) {
  let value = seed
  let byteOffset = 0
  while (true) {
    value = await sha256.encode(value)
    const size = byteLength - byteOffset
    if (size < value.byteLength) {
      yield value.slice(0, size)
      break
    } else {
      byteOffset += value.byteLength
      yield value
    }
  }
}

/**
 * @param {ReadableStream<import('../src/file/api').Block>} blockQueue
 */
export const collect = async blockQueue => {
  const blocks = []
  const reader = blockQueue.getReader()
  while (true) {
    const next = await reader.read()
    if (next.done) {
      return blocks
    } else {
      blocks.push(next.value)
    }
  }
}

export { File, CID, fetch }
