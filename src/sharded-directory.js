import * as HAMT from "@perma/map/unixfs"
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
    entries: new HAMTMap(),
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
    throw new Error(
      `Can not change written HAMT directory, but you can .fork() and make changes to it`
    )
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
  if (!(entries instanceof HAMTMap)) {
    throw new Error(`not a HAMT map: ${entries}`)
  }

  const blocks = iterateBlocks(entries.hamt, entries.hamt.root, settings)

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
 * @param {{ state: API.State<Layout> }} view
 * @returns {AsyncIterableIterator<UnixFS.DirectoryEntryLink>}
 */
export const links = ({ state }) => {
  const { entries } = state
  if (!(entries instanceof HAMTMap)) {
    throw new Error(`not a HAMT map: ${entries}`)
  }
  return iterateLinks(entries.hamt, entries.hamt.root, state.settings)
}

/**
 * @template {unknown} Layout
 * @param {HAMT.PersistentHashMap<UnixFS.FileLink | UnixFS.DirectoryLink>} hamt
 * @param {HAMT.BitmapIndexedNode<UnixFS.FileLink | UnixFS.DirectoryLink>} node
 * @param {API.EncoderSettings<Layout>} settings
 * @returns {AsyncIterableIterator<UnixFS.DirectoryEntryLink>}
 */
const iterateLinks = async function* (hamt, node, settings) {
  for (const ent of HAMT.iterate(node)) {
    if ('key' in ent) {
      yield /** @type {UnixFS.DirectoryEntryLink} */ ({
        name: `${ent.prefix ?? ''}${ent.key ?? ''}`,
        dagByteLength: ent.value.dagByteLength,
        cid: ent.value.cid,
      })
    } else {
      const entries = []
      for await (const link of iterateLinks(hamt, ent.node, settings)) {
        entries.push(link)
      }

      const shard = UnixFS.createDirectoryShard(
        entries,
        HAMT.bitField(node),
        HAMT.tableSize(hamt),
        murmur364.code
      )
      const block = await encodeHAMTShardBlock(shard, settings)

      yield /** @type {UnixFS.ShardedDirectoryLink} */ ({
        name: ent.prefix,
        dagByteLength: UnixFS.cumulativeDagByteLength(block.bytes, block.value.entries),
        cid: block.cid
      })
    }
  }
}

/**
 * @template {unknown} Layout
 * @param {HAMT.PersistentHashMap<UnixFS.FileLink | UnixFS.DirectoryLink>} hamt
 * @param {HAMT.BitmapIndexedNode<UnixFS.FileLink | UnixFS.DirectoryLink>} node
 * @param {API.EncoderSettings<Layout>} settings
 * @returns {AsyncIterableIterator<UnixFS.BlockView<UnixFS.DirectoryShard>>}
 */
const iterateBlocks = async function* (hamt, node, settings) {
  /** @type {UnixFS.DirectoryEntryLink[]} */
  const entries = []
  for (const ent of HAMT.iterate(node)) {
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
    HAMT.bitField(node),
    HAMT.tableSize(hamt),
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
    entries: new HAMTMap(HAMT.from(state.entries.entries())),
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

  links() {
    return links(this)
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
 * Facade for PersistentHashMap that implements Map.
 * @implements {Map<string, API.EntryLink>}
 */
class HAMTMap {
  /**
   * @param {HAMT.PersistentHashMap<API.EntryLink>} [hamt]
   */
  constructor (hamt = HAMT.empty()) {
    /** @type {HAMT.PersistentHashMap<API.EntryLink>} */
    this.hamt = hamt
  }

  clear() {
    this.hamt = HAMT.empty()
  }

  /**
   * @param {string} key
   */
  delete(key) {
    const exists = this.hamt.has(key)
    this.hamt = this.hamt.delete(key)
    return exists
  }

  /**
   * @param {(value: API.EntryLink, key: string, map: Map<string, API.EntryLink>) => void} callbackfn
   * @param {any} [thisArg]
   */
  forEach(callbackfn, thisArg = this) {
    for (const [k, v] of this.hamt.entries()) {
      callbackfn.call(thisArg, v, k, this)
    }
  }

  /**
   * @param {string} key
   */
  get(key) {
    return this.hamt.get(key)
  }

  /**
   * @param {string} key
   */
  has(key) {
    return this.hamt.has(key)
  }

  /**
   * @param {string} key 
   * @param {API.EntryLink} value 
   */
  set(key, value) {
    this.hamt = this.hamt.set(key, value)
    return this
  }

  get size () {
    return this.hamt.size
  }

  [Symbol.iterator]() {
    return this.hamt.entries()
  }

  get [Symbol.toStringTag]() {
    return '[object HAMTMap]'
  }

  entries() {
    return this.hamt.entries()
  }

  keys() {
    return this.hamt.keys()
  }

  values() {
    return this.hamt.values()
  }
}
