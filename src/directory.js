import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
export * from "./directory/api.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @template [Layout=unknown]
 * @param {API.Options<Layout>} config
 * @returns {API.View<Layout>}
 */
export const create = ({ writer, settings = defaults(), metadata = {} }) =>
  new DirectoryWriter({
    writer,
    metadata,
    settings,
    entries: new Map(),
    closed: false,
  })

/**
 * @template {unknown} L
 * @template {{ state: API.State<L> }} View
 * @param {View} view
 * @param {string} name
 * @param {API.EntryLink} link
 * @param {API.WriteOptions} options
 */
export const set = (view, name, link, { overwrite = false } = {}) => {
  const writable = asWritable(view.state)
  if (name.includes("/")) {
    throw new Error(
      `Directory entry name "${name}" contains forbidden "/" character`
    )
  }
  if (!overwrite && writable.entries.has(name)) {
    throw new Error(`Directory already contains entry with name "${name}"`)
  } else {
    writable.entries.set(name, link)
    return view
  }
}

/**
 * @template {unknown} L
 * @template {{ state: API.State<L> }} View
 * @param {View} view
 * @param {string} name
 */
export const remove = (view, name) => {
  const writer = asWritable(view.state)
  writer.entries.delete(name)
  return view
}

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
      `Can not change written directory, but you can .fork() and make changes to it`
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
  const entries = [...links(view)]
  const node = UnixFS.createFlatDirectory(entries, metadata)
  const bytes = UnixFS.encodeDirectory(node)
  const digest = await settings.hasher.digest(bytes)
  /** @type {UnixFS.Link<UnixFS.Directory>} */
  const cid = settings.linker.createLink(UnixFS.code, digest)

  // we make sure that writer has some capacity for this write. If it
  // does not we await.
  if ((writer.desiredSize || 0) <= 0) {
    await writer.ready
  }
  // once writer has some capacity we write a block, however we do not
  // await completion as we don't care when it's taken off the stream.
  writer.write({ cid, bytes })

  if (closeWriter) {
    await writer.close()
  } else if (releaseLock) {
    writer.releaseLock()
  }

  return {
    cid,
    dagByteLength: UnixFS.cumulativeDagByteLength(bytes, entries),
  }
}

/**
 * @template {unknown} Layout
 * @param {{ state: API.State<Layout> }} view
 * @returns {IterableIterator<UnixFS.DirectoryEntryLink>}
 */
export const links = function* ({ state }) {
  for (const [name, { dagByteLength, cid }] of state.entries) {
    yield /** @type {UnixFS.DirectoryEntryLink} */ ({
      name,
      dagByteLength,
      cid,
    })
  }
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
  new DirectoryWriter({
    writer,
    metadata,
    settings,
    entries: new Map(state.entries.entries()),
    closed: false,
  })

/**
 * @template [Layout=unknown]
 * @implements {API.View<Layout>}
 */
class DirectoryWriter {
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
