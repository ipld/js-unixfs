import type {
  FileLink as Link,
  File,
  CID,
  Metadata,
  BlockEncoder,
  MultihashDigest,
  MultihashHasher,
  Phantom,
} from "../../unixfs.js"
import * as Chunker from "../chunker/api.js"

export interface Layout<
  Options = unknown,
  State extends { nodes?: void; leaves?: void } = object,
  Result = State & { nodes: Branch[]; leaves: Leaf[] }
> {
  /**
   * DAG layouts are usually configurable through layout specific options.
   * It is expected that implementations will:
   *
   * 1. Come with default options exposed through this field.
   * 2. Provide a configuration function returning `FileBuilder` with
   *    customized options.
   */
  options: Options

  /**
   * When new file is imported importer will call file builders `open`
   * function passing it file metadata and builder options. Here builder
   * can initialize implementation specific state according to given
   * paramateres.
   *
   * Please note it is important that builder does not mutate any state outside
   * of returned state object as order of calls is non deterministic.
   */

  open(options: Options): State

  /**
   * Importer takes care reading file content chunking it and even producing
   * leaf blocks for those chunks. After it produced some leaf blocks it will
   * call `write` passing back builder a state (that was returned by `open`
   * or previous `write / link` call) and ordered set of leaf block info.
   *
   * Builder implementation can store that information and / or produce file
   * DAG node sticking it into `state.nodes`. Importer than will take nodes
   * that were added and encode them into blocks.
   */
  write(state: State, leaves: Chunker.Buffer[]): WriteResult<State>

  /**
   * After importer passed all the leaves to builders `write` it will call
   * `close` so that builder can produce nodes from the remaining leaves
   * and build up to a root node.
   */
  close(state: State, metadata?: Metadata): CloseResult
}

export type WriteResult<State> = {
  layout: State
  nodes: Branch[]
  leaves: Leaf[]
}

export interface CloseResult {
  root: Branch
  nodes: Branch[]
}

export interface Branch {
  id: NodeID
  children: NodeID[]

  metadata?: Metadata
}

export interface Leaf {
  id: NodeID
  content: Chunker.Buffer

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

export interface CreateCID {
  <Code extends number, Alg extends number>(
    code: Code,
    hash: MultihashDigest<Alg>
  ): CID<0 | 1, Code, Alg>
}

export type { MultihashHasher, Link, Metadata }
