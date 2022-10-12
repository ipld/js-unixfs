import type {
  FileLink as Link,
  File,
  Metadata,
  BlockEncoder,
  MultihashDigest,
  MultihashHasher,
  Phantom,
} from "../../unixfs.js"
import * as Chunker from "../chunker/api.js"

export interface LayoutEngine<Layout> {
  /**
   * When new file is imported importer will call file builders `open`
   * function. Here layout implementation can initialize implementation
   * specific state.
   *
   * Please note it is important that builder does not mutate any state outside
   * of returned state object as order of calls is non deterministic.
   */

  open(): Layout

  /**
   * Importer takes care reading file content chunking it. Afet it produces some
   * chunks it will pass those via `write` call along with current layout a
   * state (which was returned by `open` or previous `write` calls).
   *
   * Layout engine implementation is responsible for returning new layout along
   * with all the leaf and branch nodes it created as a result.
   *
   * Note: Layout engine should not hold reference to chunks or nodes to avoid
   * unecessary memory use.
   */
  write(layout: Layout, chunks: Chunker.Chunk[]): WriteResult<Layout>

  /**
   * After importer wrote all the chunks through `write` calls it will call
   * `close` so that layout engine can produce all the remaining nodes and
   * along with a root.
   */
  close(layout: Layout, metadata?: Metadata): CloseResult
}

export type WriteResult<Layout> = {
  layout: Layout
  nodes: Branch[]
  leaves: Leaf[]
}

export interface CloseResult {
  root: Node
  nodes: Branch[]
  leaves: Leaf[]
}

export interface Branch {
  id: NodeID
  children: NodeID[]

  metadata?: Metadata
}

export interface Leaf {
  id: NodeID
  content?: Chunker.Chunk

  children?: void
}

export type Node = Leaf | Branch

export type NodeID = ID<Node>

export type ID<T> = PropertyKey & Phantom<T>

export type FileChunkEncoder =
  | BlockEncoder<PB, Uint8Array>
  | BlockEncoder<RAW, Uint8Array>

export type PB = 0x70
export type RAW = 0x55

export interface FileEncoder {
  code: PB
  encode(node: File): Uint8Array
}

export type { MultihashHasher, Link, Metadata }
