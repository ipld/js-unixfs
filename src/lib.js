import * as PB from "@ipld/dag-pb"
import * as API from "./api.js"
import { NodeType } from "./api.js"
import { Data } from "./unixfs.proto.js"

/** @type {ReadonlyArray<never>} */
const EMPTY = Object.freeze([])
const EMPTY_BUFFER = new Uint8Array(0)

const BLANK = Object.freeze({})
export const DEFAULT_FILE_MODE = parseInt("0644", 8)
export const DEFAULT_DIRECTORY_MODE = parseInt("0755", 8)

export { NodeType }
export const code = PB.code
export const name = "UnixFS"

/**
 * @param {API.IData} data
 * @param {ReadonlyArray<PB.PBLink>} links
 */
const encodePB = (data, links) => {
  Object(globalThis).debug && console.log({ data, links })
  return PB.encode({
    Data: Data.encode(data).finish(),
    // We can cast to mutable array as we know no mutation occurs there
    Links: /** @type {PB.PBLink[]} */ (links),
  })
}

/**
 * @param {Uint8Array} content
 * @returns {API.Raw}
 */
export const createRaw = content => ({
  type: NodeType.Raw,
  content,
})

/**
 *
 * @param {Uint8Array} content
 * @returns {API.ByteView<API.Raw>}
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
 * @param {API.UnknownFile} node
 * @param {boolean} [ignoreMetadata]
 * @returns {API.ByteView<API.FileChunk|API.FileShard|API.SimpleFile|API.AdvancedFile>}
 */
export const encodeFile = (node, ignoreMetadata = false) => {
  const file = matchFile(node)
  const metadata = ignoreMetadata ? BLANK : node
  switch (file.kind) {
    case "simple":
      return encodeSimpleFile(file.content, metadata)
    case "advanced":
      return encodeAdvancedFile(file.parts, metadata)
    case "complex":
      return encodeComplexFile(file.content, file.parts, metadata)
  }
}

/**
 * @param {Uint8Array} content
 * @returns {API.ByteView<API.FileChunk>}
 */
export const encodeFileChunk = content => encodeSimpleFile(content, BLANK)

/**
 * @param {ReadonlyArray<API.DAGLink>} parts
 * @returns {API.ByteView<API.FileShard>}
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
 * @param {ReadonlyArray<API.FileLink>} parts
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.ByteView<API.AdvancedFile>}
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
 * @param {API.DAGLink} dag
 * @returns {PB.PBLink}
 */
export const encodeLink = dag => ({
  Tsize: dag.dagByteLength,
  // @ts-ignore - @see https://github.com/multiformats/js-multiformats/pull/161
  Hash: cid,
})

/**
 *
 * @param {Uint8Array} content
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.SimpleFile}
 */
export const createSimpleFile = (content, metadata = BLANK) => ({
  type: NodeType.File,
  content,
  ...decodeMetadata(metadata),
})

/**
 * @param {Uint8Array} content
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.ByteView<API.SimpleFile>}
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
 * @param {ReadonlyArray<API.FileLink>} parts
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.ByteView<API.ComplexFile>}
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

export const createEmptyFile = (metadata = BLANK) => ({
  type: NodeType.File,
  kind: "empty",
  content: undefined,
  parts: [],
  ...decodeMetadata(metadata),
})

/**
 *
 * @param {API.DirectoryLink[]} entries
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.Directory}
 */
export const createFlatDirectory = (entries, metadata = BLANK) => ({
  type: NodeType.Directory,
  ...metadata,
  entries,
})

/**
 * @param {API.FlatDirectory} node
 * @returns {API.ByteView<API.FlatDirectory>}
 */
export const encodeDirectory = node =>
  encodePB(
    {
      Type: node.type,
      ...encodeDirectoryMetadata(node),
    },
    node.entries.map(encodeNamedLink)
  )

/**
 * @param {API.ShardedDirectoryLink[]} entries
 * @param {Uint8Array} bitfield
 * @param {number} fanout
 * @param {number} hashType
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.ShardedDirectory}
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
  ...decodeMetadata(metadata),
})

/**
 * @param {API.ShardedDirectoryLink[]} entries
 * @param {Uint8Array} bitfield
 * @param {number} fanout
 * @param {number} hashType
 * @returns {API.DirectoryShard}
 */
export const createDirectoryShard = (entries, bitfield, fanout, hashType) =>
  createShardedDirectory(entries, bitfield, fanout, hashType, BLANK)

/**
 * @param {API.ShardedDirectory} node
 * @returns {API.ByteView<API.ShardedDirectory>}
 */
export const encodeHAMTShard = ({
  bitfield,
  fanout,
  hashType,
  entries,
  ...metadata
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
 * @param {API.NodeMetadata} [metadata]
 * @returns {API.Symlink}
 */
export const createSymlink = (path, metadata = BLANK) => ({
  type: NodeType.Symlink,
  content: path,
  ...decodeMetadata(metadata),
})

/**
 * @param {API.Symlink} node
 * @returns {API.ByteView<API.Symlink>}
 */
export const encodeSymlink = ({ content, ...metadata }) =>
  // We do not include filesize on symlinks because that is what go-ipfs does
  // when doing `ipfs add mysymlink`. js-ipfs on the other hand seems to store
  // it, here we choose to follow go-ipfs
  // @see https://explore.ipld.io/#/explore/QmPZ1CTc5fYErTH2XXDGrfsPsHicYXtkZeVojGycwAfm3v
  // @see https://github.com/ipfs/js-ipfs-unixfs/issues/195
  encodePB(
    {
      Type: NodeType.Symlink,
      Data: content,
      ...encodeMetadata(metadata),
    },
    []
  )

/**
 *
 * @param {API.Node} node
 * @param {boolean} root
 * @returns {API.ByteView<API.Node>}
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
 * @param {API.ByteView<API.Node>} bytes
 */
export const decode = bytes => {
  const pb = PB.decode(bytes)
  const message = Data.decode(/** @type {Uint8Array} */ (pb.Data))

  const {
    Type: type,
    Data: data,
    mtime,
    blocksizes,
    ...rest
  } = Data.toObject(message, {
    defaults: false,
    arrays: true,
    longs: Number,
    objects: false,
  })

  const node = {
    type,
    ...rest,
    ...(data ? { content: data } : undefined),
    ...decodeBlocksizes(type, blocksizes),
    ...decodeMtime(mtime),
    ...decodeLinks(type, pb.Links),
  }

  switch (message.Type) {
    case NodeType.Raw:
      return node
    case NodeType.File:
      return matchFile(/** @type {API.UnknownFile} */ (node))
    case NodeType.Directory:
      return node
    case NodeType.HAMTShard:
      return node
    case NodeType.Symlink:
      return node
    default:
      throw new TypeError(`Unsupported node type ${message.Type}`)
  }
}

/**
 * @param {API.UnixTime|undefined} mtime
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
 * @param {NodeType} type
 * @param {PB.PBLink[]} links
 */
const decodeLinks = (type, links) => {
  switch (type) {
    case NodeType.File:
      return links && links.length > 0
        ? { parts: links.map(decodeAnonymousLink) }
        : undefined
    case NodeType.Directory:
    case NodeType.HAMTShard:
      return links ? { entries: links.map(decodeNamedLink) } : undefined
    default:
      return undefined
  }
}

/**
 * @param {PB.PBLink} link
 */
const decodeAnonymousLink = link => ({
  cid: link.Hash,
  byteLength: link.Tsize || 0,
})

/**
 * @param {PB.PBLink} link
 */
const decodeNamedLink = link => ({
  cid: link.Hash,
  name: link.Name || "",
  byteLength: link.Tsize || 0,
})

/**
 * @param {ReadonlyArray<API.DAGLink>} links
 * @returns {number}
 */
const cumulativeContentByteLength = links =>
  links.reduce((size, link) => size + link.contentByteLength, 0)

/**
 *
 * @param {API.DAGLink} link
 */
const contentByteLength = link => link.contentByteLength

/**
 * @param {API.NamedDAGLink<unknown>} link
 * @returns {import('@ipld/dag-pb').PBLink}
 */
const encodeNamedLink = ({ name, dagByteLength, cid }) => ({
  Name: name,
  TSize: dagByteLength,
  // @ts-ignore - @see https://github.com/multiformats/js-multiformats/pull/161
  Hash: cid,
})

/**
 * @param {API.NodeMetadata} metadata
 */
export const encodeDirectoryMetadata = metadata =>
  encodeMetadata(metadata, DEFAULT_DIRECTORY_MODE)

/**
 * @param {API.NodeMetadata} metadata
 * @param {API.Mode} defaultMode
 */
export const encodeMetadata = (metadata, defaultMode = DEFAULT_FILE_MODE) => ({
  ...encodeMode(metadata, defaultMode),
  ...encodeMTime(metadata),
})

/**
 * @param {API.NodeMetadata} metadata
 */
export const decodeMetadata = ({ mode, mtime }) => ({
  ...(mode == null ? undefined : { mode: decodeMode(mode) }),
  ...(mtime == null ? undefined : { mtime }),
})

/**
 * @param {{ mtime?: API.MTime }} metadata
 */
const encodeMTime = ({ mtime }) => {
  return mtime == null
    ? undefined
    : mtime.nsecs !== 0
    ? { mtime: { Seconds: mtime.secs, FractionalNanoseconds: mtime.nsecs } }
    : { mtime: { Seconds: mtime.secs } }
}

/**
 * @param {{ mode?: number}} metadata
 * @param {number} defaultMode
 */
export const encodeMode = ({ mode: specifiedMode }, defaultMode) => {
  const mode = specifiedMode == null ? undefined : decodeMode(specifiedMode)
  return mode === defaultMode ? undefined : mode == null ? undefined : { mode }
}

/**
 * @param {API.Mode} mode
 * @returns {API.Mode}
 */
const decodeMode = mode => (mode & 0xfff) | (mode & 0xfffff000)

/**
 * @param {API.UnknownFile} node
 * @returns {never
 * |(API.SimpleFile & { kind: 'simple' })
 * |(API.AdvancedFile & { kind: 'advanced' })
 * |(API.ComplexFile & { kind: 'complex' })
 * }
 */
export const matchFile = ({
  content = EMPTY_BUFFER,
  parts = EMPTY,
  ...node
}) => {
  if (parts.length === 0) {
    return new SimpleFileView({ ...node, content })
  } else if (content.byteLength === 0) {
    return new AdvancedFileView({ ...node, parts })
  } else {
    return new ComplexFileView({ ...node, content, parts })
  }
}

/**
 * @implements {API.SimpleFile}
 */
class SimpleFileView {
  /**
   * @param {API.SimpleFile} node
   */
  constructor(node) {
    this.node = node
  }
  /** @type {"simple"} */
  get kind() {
    return "simple"
  }
  get content() {
    return this.node.content
  }

  get mtime() {
    return this.node.mtime
  }
  get mode() {
    return this.node.mode
  }
  /**
   * @returns {NodeType.File}
   */
  get type() {
    return NodeType.File
  }

  get filesize() {
    return this.content.byteLength
  }

  encode() {
    return encodeSimpleFile(this.node.content, this.node)
  }
}

/**
 * @implements {API.AdvancedFile}
 */
class AdvancedFileView {
  /**
   * @param {API.AdvancedFile} node
   */
  constructor(node) {
    this.node = node
  }
  /** @type {"advanced"} */
  get kind() {
    return "advanced"
  }

  get parts() {
    return this.node.parts
  }
  get mtime() {
    return this.node.mtime
  }
  get mode() {
    return this.node.mode
  }
  /**
   * @returns {NodeType.File}
   */
  get type() {
    return NodeType.File
  }
  get fileSize() {
    return cumulativeContentByteLength(this.node.parts)
  }
  get blockSizes() {
    return this.node.parts.map(contentByteLength)
  }

  encode() {
    return encodeAdvancedFile(this.node.parts, this.node)
  }
}

/**
 * @implements {API.ComplexFile}
 */
class ComplexFileView {
  /**
   * @param {API.ComplexFile} node
   */
  constructor(node) {
    this.node = node
  }
  /** @type {"complex"} */
  get kind() {
    return "complex"
  }

  get content() {
    return this.node.content
  }
  get parts() {
    return this.node.parts
  }

  get firstPart() {
    return this.node.content
  }

  get restParts() {
    return this.node.parts
  }
  get mtime() {
    return this.node.mtime
  }
  get mode() {
    return this.node.mode
  }
  /**
   * @returns {NodeType.File}
   */
  get type() {
    return NodeType.File
  }
  get fileSize() {
    return (
      this.node.content.byteLength +
      cumulativeContentByteLength(this.node.parts)
    )
  }
  get blockSizes() {
    return this.node.parts.map(contentByteLength)
  }

  encode() {
    return encodeComplexFile(this.node.content, this.node.parts, this.node)
  }
}
