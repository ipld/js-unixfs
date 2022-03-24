import type { Chunker } from "./chunker/api.js"
import type { LayoutEngine, NodeID } from "./layout/api.js"
import * as UnixFS from "../unixfs.js"
import type {
  CID,
  Block,
  BlockEncoder,
  MultihashHasher,
  MultihashDigest,
} from "../unixfs.js"

export * from "../writer/api.js"
import * as ChunkerService from "./chunker.js"

export type { Chunker, LayoutEngine, MultihashHasher, MultihashDigest, Block }

export interface FileWriterService<Layout> extends FileWriterConfig<Layout> {
  blockQueue: BlockQueue
}

export interface FileWriterConfig<Layout = unknown> {
  /**
   * Chunker which will be used to split file content into chunks.
   */
  chunker: Chunker

  /**
   * If provided leaves will be encoded as raw blocks, unless file has a
   * metadata. This is what `rawLeaves` options used to be except instead
   * of boolean you pass an encoder that will be used.
   */
  fileChunkEncoder: FileChunkEncoder

  /**
   * If provided and file contains single chunk it will be encoded with this
   * encoder. This is what `reduceSingleLeafToSelf` option used to be except
   * instead of boolean you pass an encoder that will be used.
   */
  smallFileEncoder: FileChunkEncoder

  fileEncoder: FileEncoder

  /**
   * Builder that will be used to build file DAG from the leaf nodes.
   */
  fileLayout: LayoutEngine<Layout>

  /**
   * Hasher used to compute multihash for each block in the file.
   */
  hasher: MultihashHasher

  /**
   * This function is used to create CIDs from multihashes. This is similar
   * to `cidVersion` option except you give it CID creator to use.
   */
  createCID: CreateCID
}

export interface Queue<T> extends ReadableStreamController<T> {
  readonly desiredSize: number

  ready: Promise<void>
}

export interface BlockQueue extends Queue<Block> {}

export type FileChunkEncoder =
  | BlockEncoder<PB, Uint8Array>
  | BlockEncoder<RAW, Uint8Array>

export interface FileEncoder {
  code: PB
  encode(node: UnixFS.File): Uint8Array
}

export interface CreateCID {
  <Code extends number>(code: Code, hash: MultihashDigest): CID
}

export interface EncodedFile {
  id: NodeID
  block: Block
  link: UnixFS.FileLink
}

export type PB = 0x70
export type RAW = 0x55

/**
 * Interface defines API for importable content that is just a subset of `Blob`
 * interface with some optional metadata fields. This implies that you can pass
 * `Blob` instances anywhere `BlobContent` is required. It also means you could
 * pass `Object.assign(blob, { mtime, mode })` whenever you want to pass content
 * with optional metadata.
 */
export interface BlobContent extends BlobMetadata {
  readonly size: number

  stream(): ReadableStream<Uint8Array>
  // text(): Promise<string>
  // arrayBuffer(): Promise<ArrayBuffer>
  // slice(start?: number, end?: number, contentType?: string): Blob
}

/**
 * Optional unixfs metadata.
 */
export interface BlobMetadata extends UnixFS.Metadata {
  readonly type: string
}

/**
 * `FileContent` extends `BlobContent` with a required `name` field, which makes
 * diffence between two equivalent to difference between `File` and `Blob`.
 *
 * Interface is desigend to be compatible with `File` instances and to allow
 * optional metadata by passing `Object.assign(file, { mtime, mode })`.
 */
export interface FileContent extends BlobContent {
  /**
   * File path relative to directory it will be imported into.
   *
   * **Note:** File name is actually used as a file path which is to imply it
   * can contain contains `/` delimiters.
   */
  readonly name: string
}

export type FileState<Layout = unknown> =
  | OpenFile<Layout>
  | ClosedFile<Layout>
  | LinkedFile

export interface FileView<State extends FileState = FileState> {
  state: State
}

export interface OpenFile<Layout = unknown> {
  readonly type: "file"
  readonly status: "open"
  readonly metadata: UnixFS.Metadata
  readonly service: FileWriterService<Layout>

  writing: boolean

  chunker: ChunkerService.Chunker
  layout: Layout
}

export interface ClosedFile<Layout = unknown> {
  readonly type: "file"
  readonly status: "closed"
  readonly service: FileWriterService<Layout>
  readonly metadata: UnixFS.Metadata
  writing: boolean
  chunker: ChunkerService.Chunker
  layout: Layout
}

export interface LinkedFile {
  readonly type: "file"
  readonly status: "linked"

  state: UnixFS.FileLink
}
