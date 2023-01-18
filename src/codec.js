import * as PB from "@ipld/dag-pb"
import * as UnixFS from "./unixfs.js"
import { NodeType } from "./unixfs.js"
import { Data } from "../gen/unixfs.js"

export * from "./unixfs.js"

/** @type {ReadonlyArray<any>} */
const EMPTY = Object.freeze([])
const EMPTY_BUFFER = new Uint8Array(0)

const BLANK = Object.freeze({})
export const DEFAULT_FILE_MODE = parseInt("0644", 8)
export const DEFAULT_DIRECTORY_MODE = parseInt("0755", 8)

export const code = PB.code
export const name = "UnixFS"

/**
 * @param {UnixFS.IData} data
 * @param {ReadonlyArray<UnixFS.PBLink>} links
 */
const encodePB = (data, links) => {
  Object(globalThis).debug && console.log({ data, links })

  return PB.encode(
    // We run through prepare as links need to be sorted by name which it will
    // do.
    PB.prepare({
      Data: Data.encode(data).finish(),
      // We can cast to mutable array as we know no mutation occurs there
      Links:
        /** @type {PB.PBLink[]} */ (links),
    })
  )
}

/**
 * @param {Uint8Array} content
 * @returns {UnixFS.Raw}
 */
export const createRaw = content => ({
  type: NodeType.Raw,
  content,
})

/**
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.SimpleFile}
 */
export const createEmptyFile = metadata =>
  createSimpleFile(EMPTY_BUFFER, metadata)

/**
 * @param {Uint8Array} content
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.SimpleFile}
 */
export const createSimpleFile = (content, metadata) => ({
  type: NodeType.File,
  layout: "simple",
  content,
  metadata: decodeMetadata(metadata),
})

/**
 * @param {Uint8Array} content
 * @returns {UnixFS.FileChunk}
 */
export const createFileChunk = content => ({
  type: NodeType.File,
  layout: "simple",
  content,
})

/**
 * @param {UnixFS.FileLink[]} parts
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.AdvancedFile}
 */
export const createAdvancedFile = (parts, metadata) => ({
  type: NodeType.File,
  layout: "advanced",
  parts,
  metadata: decodeMetadata(metadata),
})

/**
 * @param {UnixFS.FileLink[]} parts
 * @returns {UnixFS.FileShard}
 */
export const createFileShard = parts => ({
  type: NodeType.File,
  layout: "advanced",
  parts,
})

/**
 * @deprecated
 * @param {Uint8Array} content
 * @param {UnixFS.FileLink[]} parts
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.ComplexFile}
 */
export const createComplexFile = (content, parts, metadata) => ({
  type: NodeType.File,
  layout: "complex",
  content,
  parts,
  metadata: decodeMetadata(metadata),
})

/**
 * @param {UnixFS.DirectoryEntryLink[]} entries
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.FlatDirectory}
 */
export const createFlatDirectory = (entries, metadata) => ({
  type: NodeType.Directory,
  metadata: decodeMetadata(metadata),
  entries,
})

/**
 * @param {UnixFS.ShardedDirectoryLink[]} entries
 * @param {Uint8Array} bitfield
 * @param {number} fanout
 * @param {number} hashType
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.ShardedDirectory}
 */
export const createShardedDirectory = (
  entries,
  bitfield,
  fanout,
  hashType,
  metadata = BLANK
) => ({
  type: NodeType.HAMTShard,
  bitfield,
  fanout: readFanout(fanout),
  hashType: readInt(hashType),
  entries,
  metadata: decodeMetadata(metadata),
})

/**
 * @param {UnixFS.ShardedDirectoryLink[]} entries
 * @param {Uint8Array} bitfield
 * @param {number} fanout
 * @param {number} hashType
 * @returns {UnixFS.DirectoryShard}
 */
export const createDirectoryShard = (entries, bitfield, fanout, hashType) => ({
  type: NodeType.HAMTShard,
  bitfield,
  fanout: readFanout(fanout),
  hashType: readInt(hashType),
  entries,
})

/**
 *
 * @param {Uint8Array} content
 * @returns {UnixFS.ByteView<UnixFS.Raw>}
 */
export const encodeRaw = content =>
  encodePB(
    {
      Type: NodeType.Raw,
      // TODO:
      Data: content.byteLength > 0 ? content : undefined,
      filesize: content.byteLength,
      // @ts-ignore
      blocksizes: EMPTY,
    },
    []
  )

/**
 * @param {UnixFS.File|UnixFS.FileChunk|UnixFS.FileShard} node
 * @param {boolean} [ignoreMetadata]
 * @returns {UnixFS.ByteView<UnixFS.SimpleFile|UnixFS.AdvancedFile|UnixFS.ComplexFile>}
 */
export const encodeFile = (node, ignoreMetadata = false) => {
  const metadata = ignoreMetadata ? BLANK : Object(node).metadata
  switch (node.layout) {
    case "simple":
      return encodeSimpleFile(node.content, metadata)
    case "advanced":
      return encodeAdvancedFile(node.parts, metadata)
    case "complex":
      return encodeComplexFile(node.content, node.parts, metadata)
    default:
      throw new TypeError(
        `File with unknown layout "${Object(node).layout}" was passed`
      )
  }
}

/**
 * @param {Uint8Array} content
 * @returns {UnixFS.ByteView<UnixFS.FileChunk>}
 */
export const encodeFileChunk = content => encodeSimpleFile(content, BLANK)

/**
 * @param {ReadonlyArray<UnixFS.FileLink>} parts
 * @returns {UnixFS.ByteView<UnixFS.FileShard>}
 */
export const encodeFileShard = parts =>
  encodePB(
    {
      Type: NodeType.File,
      blocksizes: parts.map(contentByteLength),
      filesize: cumulativeContentByteLength(parts),
    },
    parts.map(encodeLink)
  )

/**
 * @param {ReadonlyArray<UnixFS.FileLink>} parts
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.ByteView<UnixFS.AdvancedFile>}
 */
export const encodeAdvancedFile = (parts, metadata = BLANK) =>
  encodePB(
    {
      Type: NodeType.File,
      blocksizes: parts.map(contentByteLength),
      filesize: cumulativeContentByteLength(parts),

      ...encodeMetadata(metadata),
    },
    parts.map(encodeLink)
  )

/**
 * @param {UnixFS.DAGLink} dag
 * @returns {UnixFS.PBLink}
 */
export const encodeLink = dag => ({
  Name: "",
  Tsize: dag.dagByteLength,
  // @ts-ignore - @see https://github.com/multiformats/js-multiformats/pull/161
  Hash: dag.cid,
})

/**
 * @param {Uint8Array} content
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.ByteView<UnixFS.SimpleFile>}
 */

export const encodeSimpleFile = (content, metadata = BLANK) =>
  encodePB(
    {
      Type: NodeType.File,
      // adding empty file to both go-ipfs and js-ipfs produces block in
      // which `Data` is omitted but filesize and blocksizes are present.
      // For the sake of hash consistency we do the same.
      Data: content.byteLength > 0 ? content : undefined,
      filesize: content.byteLength,
      blocksizes: [],
      ...encodeMetadata(metadata),
    },
    []
  )

/**
 *
 * @param {Uint8Array} content
 * @param {ReadonlyArray<UnixFS.FileLink>} parts
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.ByteView<UnixFS.ComplexFile>}
 */
export const encodeComplexFile = (content, parts, metadata = BLANK) =>
  encodePB(
    {
      Type: NodeType.File,
      Data: content,
      filesize: content.byteLength + cumulativeContentByteLength(parts),
      blocksizes: parts.map(contentByteLength),
    },
    parts.map(encodeLink)
  )

/**
 * @param {UnixFS.FlatDirectory} node
 * @returns {UnixFS.ByteView<UnixFS.FlatDirectory>}
 */
export const encodeDirectory = node =>
  encodePB(
    {
      Type: node.type,
      ...encodeDirectoryMetadata(node.metadata || BLANK),
    },
    node.entries.map(encodeNamedLink)
  )

/**
 * @param {UnixFS.ShardedDirectory|UnixFS.DirectoryShard} node
 * @returns {UnixFS.ByteView<UnixFS.ShardedDirectory>}
 */
export const encodeHAMTShard = ({
  bitfield,
  fanout,
  hashType,
  entries,
  metadata = BLANK,
}) =>
  encodePB(
    {
      Type: NodeType.HAMTShard,
      Data: bitfield.byteLength > 0 ? bitfield : undefined,
      fanout: readFanout(fanout),
      hashType: readInt(hashType),

      ...encodeDirectoryMetadata(metadata),
    },
    entries.map(encodeNamedLink)
  )

/**
 * @param {number} n
 * @returns {number}
 */
const readFanout = n => {
  if (Math.log2(n) % 1 === 0) {
    return n
  } else {
    throw new TypeError(
      `Expected hamt size to be a power of two instead got ${n}`
    )
  }
}

/**
 * @param {number} n
 * @returns {number}
 */

const readInt = n => {
  if (Number.isInteger(n)) {
    return n
  } else {
    throw new TypeError(`Expected an integer value instead got ${n}`)
  }
}

/**
 * @param {Uint8Array} bytes
 */
const readData = bytes => (bytes.byteLength > 0 ? bytes : undefined)

/**
 * @param {Uint8Array} path
 * @param {UnixFS.Metadata} [metadata]
 * @returns {UnixFS.Symlink}
 */
export const createSymlink = (path, metadata = BLANK) => ({
  type: NodeType.Symlink,
  content: path,
  metadata: decodeMetadata(metadata),
})

/**
 * @param {UnixFS.Symlink} node
 * @param {boolean} [ignoreMetadata]
 * @returns {UnixFS.ByteView<UnixFS.Symlink>}
 */
export const encodeSymlink = (node, ignoreMetadata = false) => {
  const metadata = ignoreMetadata ? BLANK : Object(node).metadata
  // We do not include filesize on symlinks because that is what go-ipfs does
  // when doing `ipfs add mysymlink`. js-ipfs on the other hand seems to store
  // it, here we choose to follow go-ipfs
  // @see https://explore.ipld.io/#/explore/QmPZ1CTc5fYErTH2XXDGrfsPsHicYXtkZeVojGycwAfm3v
  // @see https://github.com/ipfs/js-ipfs-unixfs/issues/195
  return encodePB(
    {
      Type: NodeType.Symlink,
      Data: node.content,
      ...encodeMetadata(metadata || BLANK),
    },
    []
  )
}

/**
 * @template {UnixFS.Node} T
 * @param {T} node
 * @param {boolean} root
 */
export const encode = (node, root = true) => {
  switch (node.type) {
    case NodeType.Raw:
      return encodeRaw(node.content)
    case NodeType.File:
      return encodeFile(node)
    case NodeType.Directory:
      return encodeDirectory(node)
    case NodeType.HAMTShard:
      return encodeHAMTShard(node)
    case NodeType.Symlink:
      return encodeSymlink(node)
    default:
      throw new Error(`Unknown node type ${Object(node).type}`)
  }
}

/**
 * @param {UnixFS.ByteView<UnixFS.Node>} bytes
 * @returns {UnixFS.Node}
 */
export const decode = bytes => {
  const pb = PB.decode(bytes)
  const message = Data.decode(/** @type {Uint8Array} */ (pb.Data))

  const {
    Type: type,
    Data: data,
    mtime,
    mode,
    blocksizes,
    ...rest
  } = Data.toObject(message, {
    defaults: false,
    arrays: true,
    longs: Number,
    objects: false,
  })
  const metadata = {
    ...(mode && { mode }),
    ...decodeMtime(mtime),
  }
  /** @type {UnixFS.PBLink[]} */
  const links = pb.Links

  switch (message.Type) {
    case NodeType.Raw:
      return createRaw(data)
    case NodeType.File:
      if (links.length === 0) {
        return new SimpleFileView(data, metadata)
      } else if (data.byteLength === 0) {
        return new AdvancedFileView(
          decodeFileLinks(rest.blocksizes, links),
          metadata
        )
      } else {
        return new ComplexFileView(
          data,
          decodeFileLinks(rest.blocksizes, links),
          metadata
        )
      }
    case NodeType.Directory:
      return createFlatDirectory(decodeDirectoryLinks(links), metadata)
    case NodeType.HAMTShard:
      return createShardedDirectory(
        decodeDirectoryLinks(links),
        data || EMPTY_BUFFER,
        rest.fanout,
        rest.hashType,
        metadata
      )
    case NodeType.Symlink:
      return createSymlink(data, metadata)
    default:
      throw new TypeError(`Unsupported node type ${message.Type}`)
  }
}

/**
 * @param {UnixFS.UnixTime|undefined} mtime
 */
const decodeMtime = mtime =>
  mtime == null
    ? undefined
    : {
        mtime: { secs: mtime.Seconds, nsecs: mtime.FractionalNanoseconds || 0 },
      }

/**
 * @param {NodeType} type
 * @param {number[]|undefined} blocksizes
 */
const decodeBlocksizes = (type, blocksizes) => {
  switch (type) {
    case NodeType.File:
      return blocksizes && blocksizes.length > 0 ? { blocksizes } : undefined
    default:
      return undefined
  }
}

/**
 *
 * @param {number[]} blocksizes
 * @param {UnixFS.PBLink[]} links
 * @returns {UnixFS.FileLink[]}
 */

const decodeFileLinks = (blocksizes, links) => {
  const parts = []
  const length = blocksizes.length
  let n = 0
  while (n < length) {
    parts.push(
      /** @type {UnixFS.FileLink} */ ({
        cid: links[n].Hash,
        dagByteLength: links[n].Tsize || 0,
        contentByteLength: blocksizes[n],
      })
    )
  }
  return parts
}

/**
 * @param {UnixFS.PBLink[]} links
 * @returns {UnixFS.DirectoryEntryLink[]}
 */
const decodeDirectoryLinks = links =>
  links.map(
    link =>
      /** @type {UnixFS.DirectoryEntryLink} */ ({
        cid: link.Hash,
        name: link.Name || "",
        dagByteLength: link.Tsize || 0,
      })
  )

/**
 * @param {ReadonlyArray<UnixFS.FileLink>} links
 * @returns {number}
 */
export const cumulativeContentByteLength = links =>
  links.reduce((size, link) => size + link.contentByteLength, 0)

/**
 * @param {Uint8Array} root
 * @param {ReadonlyArray<UnixFS.DAGLink>} links
 * @returns {number}
 */
export const cumulativeDagByteLength = (root, links) =>
  links.reduce((size, link) => size + link.dagByteLength, root.byteLength)

/**
 *
 * @param {UnixFS.FileLink} link
 */
const contentByteLength = link => link.contentByteLength

/**
 * @param {UnixFS.NamedDAGLink<unknown>} link
 * @returns {UnixFS.PBLink}
 */
const encodeNamedLink = ({ name, dagByteLength, cid }) => ({
  Name: name,
  Tsize: dagByteLength,
  Hash: cid,
})

/**
 * @param {UnixFS.Metadata} metadata
 */
export const encodeDirectoryMetadata = metadata =>
  encodeMetadata(metadata, DEFAULT_DIRECTORY_MODE)

/**
 * @param {UnixFS.Metadata} metadata
 * @param {UnixFS.Mode} defaultMode
 */
export const encodeMetadata = (
  { mode, mtime },
  defaultMode = DEFAULT_FILE_MODE
) => ({
  mode: mode != null ? encodeMode(mode, defaultMode) : undefined,
  mtime: mtime != null ? encodeMTime(mtime) : undefined,
})

/**
 * @param {UnixFS.Metadata} [data]
 */
export const decodeMetadata = data =>
  data == null
    ? BLANK
    : {
        ...(data.mode == null ? undefined : { mode: decodeMode(data.mode) }),
        ...(data.mtime == null ? undefined : { mtime: data.mtime }),
      }

/**
 * @param {UnixFS.MTime} mtime
 */
const encodeMTime = mtime => {
  return mtime == null
    ? undefined
    : mtime.nsecs !== 0
    ? { Seconds: mtime.secs, FractionalNanoseconds: mtime.nsecs }
    : { Seconds: mtime.secs }
}

/**
 * @param {number} specifiedMode
 * @param {number} defaultMode
 */
export const encodeMode = (specifiedMode, defaultMode) => {
  const mode = specifiedMode == null ? undefined : decodeMode(specifiedMode)
  return mode === defaultMode || mode == null ? undefined : mode
}

/**
 * @param {UnixFS.Mode} mode
 * @returns {UnixFS.Mode}
 */
const decodeMode = mode => (mode & 0xfff) | (mode & 0xfffff000)

/**
 * @param {{content?: Uint8Array, parts?: ReadonlyArray<UnixFS.FileLink>, metadata?: UnixFS.Metadata }} node
 * @returns {UnixFS.SimpleFile|UnixFS.AdvancedFile|UnixFS.ComplexFile}
 */
export const matchFile = ({
  content = EMPTY_BUFFER,
  parts = EMPTY,
  metadata = BLANK,
  ...rest
}) => {
  if (parts.length === 0) {
    return new SimpleFileView(content, metadata)
  } else if (content.byteLength === 0) {
    return new AdvancedFileView(parts, metadata)
  } else {
    return new ComplexFileView(content, parts, metadata)
  }
}

/**
 * @implements {UnixFS.SimpleFile}
 */
class SimpleFileView {
  /**
   * @param {Uint8Array} content
   * @param {UnixFS.Metadata} metadata
   */
  constructor(content, metadata) {
    this.content = content
    this.metadata = metadata
    /**
     * @readonly
     * @type {"simple"}
     */
    this.layout = "simple"
    /**
     * @readonly
     * @type {NodeType.File}
     */
    this.type = NodeType.File
  }

  get filesize() {
    return this.content.byteLength
  }

  encode() {
    return encodeSimpleFile(this.content, this.metadata)
  }
}

/**
 * @implements {UnixFS.AdvancedFile}
 */
class AdvancedFileView {
  /**
   * @param {ReadonlyArray<UnixFS.FileLink>} parts
   * @param {UnixFS.Metadata} metadata
   */
  constructor(parts, metadata) {
    this.parts = parts
    this.metadata = metadata
  }
  /** @type {"advanced"} */
  get layout() {
    return "advanced"
  }

  /**
   * @returns {NodeType.File}
   */
  get type() {
    return NodeType.File
  }
  get fileSize() {
    return cumulativeContentByteLength(this.parts)
  }
  get blockSizes() {
    return this.parts.map(contentByteLength)
  }

  encode() {
    return encodeAdvancedFile(this.parts, this.metadata)
  }
}

/**
 * @implements {UnixFS.ComplexFile}
 */
class ComplexFileView {
  /**
   * @param {Uint8Array} content
   * @param {ReadonlyArray<UnixFS.FileLink>} parts
   * @param {UnixFS.Metadata} metadata
   */
  constructor(content, parts, metadata) {
    this.content = content
    this.parts = parts
    this.metadata = metadata
  }
  /** @type {"complex"} */
  get layout() {
    return "complex"
  }

  /**
   * @returns {NodeType.File}
   */
  get type() {
    return NodeType.File
  }
  get fileSize() {
    return this.content.byteLength + cumulativeContentByteLength(this.parts)
  }
  get blockSizes() {
    return this.parts.map(contentByteLength)
  }

  encode() {
    return encodeComplexFile(this.content, this.parts, this.metadata)
  }
}

/**
 * @param {UnixFS.File|UnixFS.Raw|UnixFS.FileChunk|UnixFS.FileShard|UnixFS.Symlink} node
 * @returns {number}
 */
export const filesize = node => {
  switch (node.type) {
    case NodeType.Raw:
    case NodeType.Symlink:
      return node.content.byteLength
    case NodeType.File:
      switch (node.layout) {
        case "simple":
          return node.content.byteLength
        case "advanced":
          return cumulativeContentByteLength(node.parts)
        case "complex":
          return (
            node.content.byteLength + cumulativeContentByteLength(node.parts)
          )
      }
    default:
      return 0
  }
}
