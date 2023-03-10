import type {
  MultihashDigest,
  MultibaseEncoder,
  BlockEncoder,
  MultihashHasher,
  Link as IPLDLink,
  Version as LinkVersion,
  Block as IPLDBlock,
  BlockView as IPLDBlockView
} from "multiformats"
import { Data, type IData } from "../gen/unixfs.js"
export type { MultihashHasher, MultibaseEncoder, MultihashDigest, BlockEncoder }
export * as Layout from "./file/layout/api"

import NodeType = Data.DataType

export { NodeType }
export type { IData, LinkVersion }

/**
 * Type representing any UnixFS node.
 */
export type Node =
  | Raw
  | SimpleFile
  | AdvancedFile
  | ComplexFile
  | Directory
  | DirectoryShard
  | ShardedDirectory
  | Symlink

export type File = SimpleFile | AdvancedFile | ComplexFile

/**
 * Logical representation of a file that fits a single block. Note this is only
 * semantically different from a `FileChunk` and your interpretation SHOULD vary
 * depending on where you encounter the node (In root of the DAG or not).
 */
export interface SimpleFile {
  readonly metadata?: Metadata

  readonly type: NodeType.File
  readonly layout: "simple"
  readonly content: Uint8Array
}

export interface Metadata {
  readonly mode?: Mode
  readonly mtime?: MTime
}

/**
 * Logical represenatation of a file that consists of multiple blocks. Note it
 * is only semantically different from a `FileShard` and your interpretation
 * SHOULD vary depending on where you encounter the node (In root of the DAG
 * or not).
 */

export interface AdvancedFile {
  readonly metadata?: Metadata

  readonly type: NodeType.File
  readonly layout: "advanced"
  readonly parts: ReadonlyArray<FileLink>
}

export type Chunk = Raw | FileChunk

/**
 * Encodes UnixFS Raw node (a leaf node of the file DAG layout). This
 * representation had been subsumed by `FileChunk` representation and
 * therefor is marked as deprecated.
 *
 * UnixFS consumers are very likely to encounter nodes of this type, as of this
 * writing JS & Go implementations can be configured to produce these nodes, in
 * trickle DAG use this configuration.
 *
 * UnixFS producers are RECOMMENDED to either use `FileChunk` representation or
 * better yet raw binary nodes (That is 0x55 multicodec) which will likely
 * relpace them in the future.
 *
 * @see https://github.com/multiformats/multicodec/blob/master/table.csv#L39
 *
 * Please note that in the wild Raw nodes are likely to come with other fiels
 * encoded but both encoder and decoder presented here will ignore them.
 *
 * @deprecated
 */
export interface Raw {
  readonly type: NodeType.Raw

  /**
   * Raw bytes of the content
   */
  readonly content: Uint8Array
}

/**
 * Logical representation of a file chunk (a leaf node of the file DAG layout).
 *
 * When large file is added to IPFS it gets chunked into smaller pieces
 * (according to the `--chunker` specified) and each chunk is encoded into this
 * representation (and linked from file DAG). Please note that in practice there
 * are many other representations for file chunks (leaf nodes) like `Raw` nodes
 * (deprecated in favor of this representation) and raw binary nodes (That is
 * 0x55 multicodec) which are on a way to surpass this representation.
 *
 * Please note that in protobuf representation there is only one `file` node
 * type with many optional fields, however different combination of fields
 * corresponds to a different semntaics and we represent each via different type.
 *
 * Also note that some file nodes may also have `mode` and `mtime` fields,
 * which we represent via `SimpleFile` type, however in practice two are
 * indistinguishable & how to interpret will only depend node is encountered
 * in DAG root position or not. That is because one could take two `SimpleFile`
 * nodes and represent their concatination via `AdvancedFile` simply by linking
 * to them. In such scenario consumer SHOULD treat leaves as `FileChunk`s and
 * ignoring their `mode` and `mtime` fileds. However if those leves are
 * encontured on their own consumer SHOULD treat them as `SimpleFile`s and
 * take `mode` and `mtime` fields into account.
 */
export interface FileChunk {
  readonly type: NodeType.File
  readonly layout: "simple"
  readonly content: Uint8Array

  readonly metadata?: Metadata
}

/**
 * Logical representation of a file shard. When large files are chunked
 * slices that span multiple blocks may be represented via file shards in
 * certain DAG layouts (e.g. balanced & trickle DAGs).
 *
 * Please note in protobuf representation there is only one `file` node type
 * with many optional fields. Different combination of those fields corresponds
 * to a different semntaics. Combination of fields in this type represent a
 * branch nodes in the file DAGs in which nodes beside leaves and root exist.
 *
 * Also note that you may encounter `FileShard`s with `mode` and `mtime` fields
 * which according to our definition would be `AdvancedFile`. However just as
 * with `FileChunk` / `SimpleFile`, here as well, you should treat node as
 * `AdvancedFile` if you encounter it in the root position (that is to say
 * regard `mode`, `mtime` field) and treat it as `FileShard` node if encountered
 * in any other position (that is ignore `mode`, `mtime` fileds).
 */
export interface FileShard {
  readonly type: NodeType.File
  readonly layout: "advanced"
  readonly parts: ReadonlyArray<FileLink>
}

export type FileLink =
  | ContentDAGLink<Uint8Array>
  | ContentDAGLink<Chunk>
  | ContentDAGLink<FileShard>

export interface ContentDAGLink<T> extends DAGLink<T> {
  /**
   * Total number of bytes in the file
   */
  readonly contentByteLength: number
}

/**
 * Represents a link to the DAG with
 */
export interface DAGLink<T = unknown> extends Phantom<T> {
  /**
   * *C*ontent *Id*entifier of the target DAG.
   */
  readonly cid: Link<T>

  /**
   * Cumulative number of bytes in the target DAG, that is number of bytes in
   * the block and all the blocks it links to.
   */
  readonly dagByteLength: number
}
/**
 * These type of nodes are not produces by referenece IPFS implementations, yet
 * such file nodes could be represented and therefor defined with this type.
 *
 * In this file representation first chunk of the file is represented by a
 * `data` field while rest of the file is represented by links.
 *
 * It is NOT RECOMMENDED to use this representation (which is why it's marked
 * deprecated), however it is still valid representation and UnixFS consumers
 * SHOULD recognize it and interpret as described.
 *
 * @deprecated
 */
export interface ComplexFile {
  readonly type: NodeType.File
  readonly layout: "complex"
  readonly content: Uint8Array

  readonly parts: ReadonlyArray<FileLink>

  readonly metadata?: Metadata
}

/**
 * This is an utility type that represents any
 * kind of file which is then refined to one of
 * the other definitions.
 */
export interface UnknownFile {
  readonly type: NodeType.File

  readonly content?: Uint8Array
  readonly parts?: ReadonlyArray<FileLink>

  readonly metadata?: Metadata
}

/**
 * Type for either UnixFS directory representation.
 */
export type Directory = FlatDirectory | ShardedDirectory

/**
 * Logacal representation of a directory that fits single block.
 */
export interface FlatDirectory {
  readonly type: NodeType.Directory
  readonly entries: ReadonlyArray<DirectoryEntryLink>

  readonly metadata?: Metadata
}

export type DirectoryEntryLink =
  | NamedDAGLink<File>
  | NamedDAGLink<Directory>
  | NamedDAGLink<Uint8Array>

export type DirectoryLink = DAGLink<Directory>

export interface NamedDAGLink<T> extends DAGLink<T> {
  readonly name: string
}

/**
 * Logical representation of directory encoded in multiple blocks (usually when
 * it contains large number of entries). Such directories are represented via
 * Hash Array Map Tries (HAMT).
 *
 * @see https://en.wikipedia.org/wiki/Hash_array_mapped_trie
 */
export interface ShardedDirectory extends DirectoryShard {}

/**
 * Logical represenatation of the shard of the sharded directory. Please note
 * that it only semantically different from `AdvancedDirectoryLayout`, in
 * practice they are the same and interpretation should vary based on view. If
 * viewed form root position it is `AdvancedDirectoryLayout` and it's `mtime`
 * `mode` field to be respected, otherwise it is `DirectoryShard` and it's
 * `mtime` and `mode` field to be ignored.
 */
export interface DirectoryShard {
  readonly type: NodeType.HAMTShard

  readonly bitfield: Uint8Array
  /*
   * HAMT table width (In IPFS it's usually 256)
   */
  readonly fanout: uint64
  /**
   * Multihash code for the hashing function used (In IPFS it's [murmur3-64][])
   *
   * [murmur3-64]:https://github.com/multiformats/multicodec/blob/master/table.csv#L24
   */
  readonly hashType: uint64

  readonly entries: ReadonlyArray<ShardedDirectoryLink>

  readonly metadata?: Metadata
}

export type ShardedDirectoryLink =
  | NamedDAGLink<File>
  | NamedDAGLink<Uint8Array>
  | NamedDAGLink<Directory>
  | NamedDAGLink<DirectoryShard>
/**
 * Logical representation of a [symbolic link][].
 *
 * [symbolic link]:https://en.wikipedia.org/wiki/Symbolic_link
 */
export interface Symlink {
  readonly type: NodeType.Symlink
  /**
   * UTF-8 encoded path to the symlink target.
   */
  readonly content: ByteView<string>

  readonly metadata?: Metadata
}

/**
 * representing the modification time in seconds relative to the unix epoch
 * 1970-01-01T00:00:00Z.
 */
export interface UnixTime {
  /**
   * (signed 64bit integer): represents the amount of seconds after or before
   * the epoch.
   */
  readonly Seconds: int64

  /**
   * (optional, 32bit unsigned integer ): when specified represents the
   * fractional part of the mtime as the amount of nanoseconds. The valid
   * range for this value are the integers [1, 999999999].
   */
  readonly FractionalNanoseconds?: fixed32
}

/**
 * The mode is for persisting the file permissions in [numeric notation].
 * If unspecified this defaults to
 * - `0755` for directories/HAMT shards
 * - `0644` for all other types where applicable
 *
 * The nine least significant bits represent `ugo-rwx`
 * The next three least significant bits represent setuid, setgid and the sticky bit.
 * The remaining 20 bits are reserved for future use, and are subject to change.
 * Spec implementations MUST handle bits they do not expect as follows: 
 * - For future-proofing the (de)serialization layer must preserve the entire
 *   `uint32` value during clone/copy operations, modifying only bit values that
 *    have a well defined meaning:
 *    `clonedValue = ( modifiedBits & 07777 ) | ( originalValue & 0xFFFFF000 )`
 * - Implementations of this spec MUST proactively mask off bits without a
 *   defined meaning in the implemented version of the spec:
 *   `interpretedValue = originalValue & 07777`

 * 
 * [numeric notation]:https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation
 * 
 * @see https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/sys_stat.h.html
 */
export type Mode = uint32

/**
 * representing the modification time in seconds relative to the unix epoch
 * 1970-01-01T00:00:00Z.
 */
export interface MTime {
  readonly secs: number
  readonly nsecs?: number
}

/**
 * Represents byte encoded representation of the `Data`. It uses type parameter
 * to capture the structure of the data it encodes.
 */
export interface ByteView<Data> extends Uint8Array, Phantom<Data> {}

/**
 * @see https://github.com/ipfs/go-bitfield
 */
export type Bitfield = Uint8Array

// TS does not really have these, create aliases so it's aligned closer
// to protobuf spec
export type int64 = number
export type fixed32 = number
export type uint64 = number

export type uint32 = number

/**
 * This is an utility type to retain unused type parameter `T`. It can be used
 * as nominal type e.g. to capture semantics not represented in actual type strucutre.
 */
export interface Phantom<T> {
  // This field can not be represented because field name is non-existings
  // unique symbol. But given that field is optional any object will valid
  // type contstraint.
  [PhantomKey]?: T
}

declare const PhantomKey: unique symbol

export interface Link<
  Data extends unknown = unknown,
  Format extends number = number,
  Alg extends number = number,
  V extends LinkVersion = LinkVersion
> extends IPLDLink<Data, Format, Alg, V> {}

export interface PBLink {
  Name?: string
  Tsize?: number
  Hash: Link
}

export interface Block<
  T = unknown,
  C extends number = number,
  A extends number = number,
  V extends LinkVersion = LinkVersion
> extends IPLDBlock<T, C, A, V> {}

export interface BlockView<
  T = unknown,
  C extends number = number,
  A extends number = number,
  V extends LinkVersion = LinkVersion
> extends IPLDBlockView<T, C, A, V> {}
