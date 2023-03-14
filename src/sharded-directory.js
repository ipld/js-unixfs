
import * as PermaMap from "@perma/map"
import * as UnixFSPermaMap from "@perma/map/unixfs"
import * as PB from "@ipld/dag-pb"
import { murmur364 } from "@multiformats/murmur3"
import { Block } from 'multiformats/block'
import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
import { set, remove } from "./directory.js"

export * from "./directory/api.js"
export { set, remove } from "./directory.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @template [Layout=unknown]
 * @param {API.Options<Layout>} config
 * @returns {API.View<Layout>}
 */
export const create = ({ writer, settings = defaults(), metadata = {} }) =>
  new HAMTDirectoryWriter({
    writer,
    metadata,
    settings,
    entries: new HashMap(),
    closed: false,
  })

/**
 * @template {API.State} Writer
 * @param {Writer} writer
 * @returns {Writer}
 */
const asWritable = writer => {
  if (!writer.closed) {
    return writer
  } else {
    throw new Error("Can not change written HAMT directory, but you can .fork() and make changes to it")
  }
}

/**
 * @template {unknown} Layout
 * @param {{ state: API.State<Layout> }} view
 * @param {API.CloseOptions} options
 * @returns {Promise<UnixFS.DirectoryLink>}
 */
export const close = async (
  view,
  { closeWriter = false, releaseLock = false } = {}
) => {
  const { writer, settings, metadata } = asWritable(view.state)
  view.state.closed = true

  const { entries } = view.state
  /* c8 ignore next 3 */
  if (!(entries instanceof HashMap)) {
    throw new Error(`not a HAMT: ${entries}`)
  }

  const hamt = entries.builder.build()
  const blocks = iterateBlocks(hamt, hamt.root, settings)

  /** @type {UnixFS.BlockView<UnixFS.DirectoryShard>?} */
  let root = null
  for await (const block of blocks) {
    root = block
    // we make sure that writer has some capacity for this write. If it
    // does not we await.
    if ((writer.desiredSize || 0) <= 0) {
      await writer.ready
    }
    // once writer has some capacity we write a block, however we do not
    // await completion as we don't care when it's taken off the stream.
    writer.write(block)
  }
  /* c8 ignore next */
  if (root == null) throw new Error("no root block yielded")

  if (closeWriter) {
    await writer.close()
  } else if (releaseLock) {
    writer.releaseLock()
  }

  return {
    cid: root.cid,
    dagByteLength: UnixFS.cumulativeDagByteLength(root.bytes, root.value.entries),
  }
}

/**
 * @template {unknown} Layout
 * @param {UnixFSPermaMap.PersistentHashMap<API.EntryLink>} hamt
 * @param {UnixFSPermaMap.BitmapIndexedNode<API.EntryLink>} node
 * @param {API.EncoderSettings<Layout>} settings
 * @returns {AsyncIterableIterator<UnixFS.BlockView<UnixFS.DirectoryShard>>}
 */
const iterateBlocks = async function* (hamt, node, settings) {
  /** @type {UnixFS.DirectoryEntryLink[]} */
  const entries = []
  for (const ent of UnixFSPermaMap.iterate(node)) {
    if ('key' in ent) {
      entries.push(/** @type {UnixFS.DirectoryEntryLink} */ ({
        name: `${ent.prefix ?? ''}${ent.key ?? ''}`,
        dagByteLength: ent.value.dagByteLength,
        cid: ent.value.cid,
      }))
    } else {
      /** @type {UnixFS.BlockView<UnixFS.DirectoryShard>?} */
      let root = null
      for await (const block of iterateBlocks(hamt, ent.node, settings)) {
        yield block
        root = block
      }
      /* c8 ignore next */
      if (root == null) throw new Error("no root block yielded")

      entries.push(/** @type {UnixFS.ShardedDirectoryLink} */ ({
        name: ent.prefix,
        dagByteLength: UnixFS.cumulativeDagByteLength(root.bytes, root.value.entries),
        cid: root.cid
      }))
    }
  }

  const shard = UnixFS.createDirectoryShard(
    entries,
    UnixFSPermaMap.bitField(node),
    UnixFSPermaMap.tableSize(hamt),
    murmur364.code
  )
  yield await encodeHAMTShardBlock(shard, settings)
}

/**
 * @template {unknown} Layout
 * @param {UnixFS.DirectoryShard} shard
 * @param {API.EncoderSettings<Layout>} settings
 * @returns {Promise<UnixFS.BlockView<UnixFS.DirectoryShard>>}
 */
async function encodeHAMTShardBlock (shard, settings) {
  const bytes = UnixFS.encodeHAMTShard(shard)
  const hash = await settings.hasher.digest(bytes)
  const cid = settings.linker.createLink(PB.code, hash)
  // @ts-ignore Link is not CID
  return new Block({ cid, bytes, value: shard })
}

/**
 * @template L1, L2
 * @param {API.View<L1>} state
 * @param {Partial<API.Options<L1|L2>>} options
 * @returns {API.View<L1|L2>}
 */
export const fork = (
  { state },
  {
    writer = state.writer,
    metadata = state.metadata,
    settings = state.settings,
  } = {}
) =>
  new HAMTDirectoryWriter({
    writer,
    metadata,
    settings,
    entries: new HashMap(UnixFSPermaMap.from(state.entries.entries()).createBuilder()),
    closed: false,
  })

/**
 * @template [Layout=unknown]
 * @implements {API.View<Layout>}
 */
class HAMTDirectoryWriter {
  /**
   * @param {API.State<Layout>} state
   */
  constructor(state) {
    this.state = state
  }
  get writer() {
    return this.state.writer
  }
  get settings() {
    return this.state.settings
  }

  /**
   * @param {string} name
   * @param {UnixFS.FileLink | UnixFS.DirectoryLink} link
   * @param {API.WriteOptions} [options]
   */

  set(name, link, options) {
    return set(this, name, link, options)
  }

  /**
   * @param {string} name
   */
  remove(name) {
    return remove(this, name)
  }

  /**
   * @template L
   * @param {Partial<API.Options<L>>} [options]
   * @returns {API.View<Layout|L>}
   */
  fork(options) {
    return fork(this, options)
  }

  /**
   * @param {API.CloseOptions} [options]
   * @returns {Promise<UnixFS.DirectoryLink>}
   */
  close(options) {
    return close(this, options)
  }

  entries() {
    return this.state.entries.entries()
  }
  /**
   * @param {string} name
   */
  has(name) {
    return this.state.entries.has(name)
  }
  get size() {
    return this.state.entries.size
  }
}

/**
 * @implements {Map<string, API.EntryLink>}
 */
class HashMap extends Map {
  /**
   * @param {UnixFSPermaMap.HashMapBuilder} [builder]
   */
  constructor (builder = UnixFSPermaMap.builder()) {
    super()
    /** @type {UnixFSPermaMap.HashMapBuilder} */
    this.builder = builder
  }

  clear() {
    this.builder = UnixFSPermaMap.builder()
  }

  /**
   * @param {string} key
   */
  delete(key) {
    const { root } = this.builder
    this.builder.delete(key)
    return this.builder.root !== root
  }

  /**
   * @param {(value: API.EntryLink, key: string, map: Map<string, API.EntryLink>) => void} callbackfn
   * @param {any} [thisArg]
   */
  forEach(callbackfn, thisArg = this) {
    for (const [k, v] of this.builder.root.entries()) {
      callbackfn.call(thisArg, v, k, this)
    }
  }

  /**
   * @param {string} key
   */
  get(key) {
    return PermaMap.get(this.builder, key)
  }

  /**
   * @param {string} key
   */
  has(key) {
    return PermaMap.has(this.builder, key)
  }

  /**
   * @param {string} key 
   * @param {API.EntryLink} value 
   */
  set(key, value) {
    this.builder.set(key, value)
    return this
  }

  get size () {
    return this.builder.size
  }

  [Symbol.iterator]() {
    return this.builder.root.entries()
  }

  entries() {
    return this.builder.root.entries()
  }

  keys() {
    return this.builder.root.keys()
  }

  values() {
    return this.builder.root.values()
  }
}
