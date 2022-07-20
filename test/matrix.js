import { CID, File, fetch } from "./util.js"
import * as Trickle from "../src/file/layout/trickle.js"
import * as Balanced from "../src/file/layout/balanced.js"
import * as FixedSize from "../src/file/chunker/fixed.js"
import * as Rabin from "../src/file/chunker/rabin.js"
import * as API from "../src/file/api.js"
import { UnixFSLeaf, UnixFSRawLeaf } from "../src/file.js"
import * as RawLeaf from "multiformats/codecs/raw"
import * as UnixFS from "../src/codec.js"
import { sha256 } from "multiformats/hashes/sha2"
import * as FZSTD from "fzstd"

const base = new URL("./dataset/testdata/", import.meta.url)

/**
 * @typedef {{
 * source: string
 * impl: string
 * trickle: boolean
 * rawLeaves: boolean
 * inlining: number
 * cidVersion: number
 * chunker: string
 * cmd: string
 * cid: string
 * }} Input
 *
 * @typedef {{
 * url: URL
 * chunkerConfig: string
 * chunker: API.Chunker
 * createCID: API.CreateCID
 * trickle: boolean
 * rawLeaves: boolean
 * fileChunkEncoder: API.FileChunkEncoder
 * smallFileEncoder: API.FileChunkEncoder
 * fileEncoder: API.FileEncoder
 * fileLayout: API.LayoutEngine<unknown>
 * hasher: API.MultihashHasher
 * inlining: number
 * cid: CID
 * impl: string
 * cmd: string
 * }} Config
 * @param {Input} input
 * @returns {Promise<Config>}
 */
export const parseConfig = async input => {
  const url = new URL(input.source, base)
  const fileChunkEncoder = input.rawLeaves
    ? RawLeaf
    : input.trickle
    ? UnixFSRawLeaf
    : UnixFSLeaf

  return {
    url: url,
    impl: input.impl,
    trickle: input.trickle,
    inlining: input.inlining,
    rawLeaves: input.rawLeaves,
    fileChunkEncoder,
    smallFileEncoder: fileChunkEncoder,
    fileEncoder: UnixFS,
    hasher: sha256,
    fileLayout: input.trickle ? Trickle : Balanced,
    createCID: input.cidVersion === 0 ? createCIDv0 : CID.createV1,
    chunkerConfig: input.chunker,
    chunker: await parseChunker(input.chunker),
    cid: CID.parse(input.cid),
    cmd: input.cmd,
  }
}

/**
 * @param {number} code
 * @param {API.MultihashDigest} hash
 * @returns
 */
const createCIDv0 = (code, hash) =>
  code === UnixFS.code ? CID.createV0(hash) : CID.createV1(code, hash)
/**
 * @param {string} input
 */
const parseChunker = input => {
  if (input.startsWith("size-")) {
    const size = parseInt(input.slice("size-".length).trim())
    return FixedSize.withMaxChunkSize(size)
  } else if (input.startsWith("rabin-")) {
    const params = input
      .slice("rabin-".length)
      .split("-")
      .map(n => parseInt(n))

    const [min, avg, max] =
      /** @type {[undefined|number, number, undefined|number]} */
      (params.length === 1 ? [undefined, ...params] : params)

    return Rabin.create(
      Rabin.configure({
        avg,
        min,
        max,
      })
    )
  } else if (input === "rabin") {
    return Rabin.create()
  } else {
    throw new Error(`Unknown chunker ${input}`)
  }
}

/**
 * @param {URL} url
 */
export const unpackFile = async url => {
  const response = await fetch(url.href)
  const buffer = await response.arrayBuffer()
  const decompressed = FZSTD.decompress(new Uint8Array(buffer))
  return new File([decompressed], String(url.pathname.split("/").pop()))
}
