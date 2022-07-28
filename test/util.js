import { File, Blob } from "@web-std/file"
import { CID } from "multiformats"
import fetch from "@web-std/fetch"
import { sha256 } from "multiformats/hashes/sha2"
import { CarWriter } from "@ipld/car"
import * as UnixFS from "../src/lib.js"

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
 * @typedef {import('../src/file/api').Block} Block
 *
 * @param {ReadableStream<Block>} blockQueue
 * @param {Block[]} [blocks]
 */
export const collect = async (blockQueue, blocks = []) => {
  for await (const block of iterate(blockQueue)) {
    blocks.push(block)
  }
  return blocks
}

/**
 * @template T
 * @param {ReadableStream<T>} stream
 */
export const iterate = async function* (stream) {
  const reader = stream.getReader()
  while (true) {
    const next = await reader.read()
    if (next.done) {
      return
    } else {
      yield next.value
    }
  }
}

/**
 * @template T, O
 * @param {AsyncIterable<T>} source
 * @param {{write(value:T): unknown, close():O|Promise<O>}} writer
 * @returns {Promise<O>}
 */
const pipe = async (source, writer) => {
  for await (const item of source) {
    writer.write(item)
  }
  return await writer.close()
}

/**
 * @param {ReadableStream<Block>} blocks
 */
export const encodeCar = blocks => {
  const { writer, out } = CarWriter.create([CID.parse("bafkqaaa")])
  pipe(iterate(blocks), {
    write: block =>
      writer.put({
        cid: /** @type {CID} */ (block.cid),
        bytes: block.bytes,
      }),
    close: () => writer.close(),
  })

  return out
}

/**
 * @param {string|URL} target
 * @param {AsyncIterable<Uint8Array>} content
 * @returns {Promise<void>}
 */
export const writeFile = async (target, content) => {
  const fs = "fs"
  const { createWriteStream } = await import(fs)
  const file = createWriteStream(target)
  for await (const chunk of content) {
    file.write(chunk)
  }

  return await new Promise((resolve, reject) =>
    file.close(
      /**
       * @param {unknown} error
       */
      error => (error ? reject(error) : resolve(undefined))
    )
  )
}

/**
 * @param {UnixFS.FileWriterConfig} fs
 * @param {BlobPart[]} content
 */
export const importFile = async (fs, content) => {
  const file = UnixFS.createFileWriter(fs)
  const blob = new Blob(content)
  /** @type {ReadableStream<Uint8Array>} */
  // @ts-ignore
  const stream = blob.stream()
  for await (const chunk of iterate(stream)) {
    file.write(chunk)
  }
  return await file.close()
}

export { File, CID, fetch }
