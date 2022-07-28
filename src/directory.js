import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
export * from "./directory/api.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @template [Layout=unknown]
 * @param {API.DirectoryWriterOptions<Layout>} config
 * @param {API.Metadata} metadata
 * @returns {API.DirectoryWriterView<Layout>}
 */
export const create = (
  { writable, preventClose = true, releaseLock = false, settings = defaults() },
  metadata = {}
) =>
  new DirectoryWriter(
    writable.getWriter(),
    metadata,
    settings,
    new Map(),
    false,
    !preventClose,
    releaseLock
  )

/**
 * @template {API.State} Writer
 * @param {Writer} writer
 * @param {string} name
 * @param {UnixFS.FileLink | UnixFS.DirectoryLink} link
 * @param {API.WriteOptions} [options]
 * @returns {Writer}
 */
export const write = (writer, name, link, { overwrite = false } = {}) => {
  const writable = asWritable(writer)
  if (name.includes("/")) {
    throw new Error(
      `Directory entry name "${name}" contains forbidden "/" character`
    )
  }
  if (!overwrite && writable.entries.has(name)) {
    throw new Error(`Directory already contains entry with name "${name}"`)
  } else {
    const { cid, dagByteLength } = link
    writable.entries.set(name, { name, cid, dagByteLength })
    return writable
  }
}

/**
 * @template {API.State} Writer
 * @param {Writer} writer
 * @param {string} name
 * @returns {Writer}
 */
export const remove = (writer, name) => {
  asWritable(writer).entries.delete(name)
  return writer
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
 * @template Layout
 * @param {API.State<Layout>} state
 * @returns {Promise<UnixFS.DirectoryLink>}
 */
export const close = async (
  state,
  closeWriter = false,
  releaseLock = false
) => {
  const { writer, settings, entries, metadata } = asWritable(state)
  state.closed = true
  const links = [...entries.values()]
  const node = UnixFS.createFlatDirectory(links, metadata)
  const bytes = UnixFS.encodeDirectory(node)
  const digest = await settings.hasher.digest(bytes)
  const cid = settings.linker.createLink(UnixFS.code, digest)
  await writer.write({ cid, bytes })
  if (closeWriter) {
    await writer.close()
  } else if (releaseLock) {
    writer.releaseLock()
  }

  return {
    cid,
    dagByteLength: UnixFS.cumulativeDagByteLength(bytes, links),
  }
}

/**
 * @template L
 * @template {API.State<L>} Writer
 * @param {Writer} directoryWriter
 * @param {object} [options]
 * @param {API.WritableBlockStream} [options.writable]
 * @param {boolean} [options.releaseLock]
 * @param {boolean} [options.preventClose]
 * @returns {API.DirectoryWriterView<L>}
 */
export const fork = (
  { writer, metadata, settings, entries, closeWriter, releaseWriter },
  {
    writable,
    releaseLock = writable ? releaseWriter : false,
    preventClose = writable ? !closeWriter : true,
  } = {}
) =>
  new DirectoryWriter(
    writable ? writable.getWriter() : writer,
    metadata,
    settings,
    new Map(entries.entries()),
    false,
    !preventClose,
    releaseLock
  )

/**
 * @template [Layout=unknown]
 * @implements {API.DirectoryWriterView<Layout>}
 */
class DirectoryWriter {
  /**
   * @param {API.BlockWriter} writer
   * @param {UnixFS.Metadata} metadata
   * @param {API.EncoderSettings<Layout>} settings
   * @param {Map<string, UnixFS.DirectoryEntryLink>} entries
   * @param {boolean} closed
   * @param {boolean} closeWriter
   * @param {boolean} releaseWriter
   */
  constructor(
    writer,
    metadata,
    settings,
    entries,
    closed,
    closeWriter,
    releaseWriter
  ) {
    this.writer = writer
    this.metadata = metadata
    this.settings = settings
    this.entries = entries
    this.closeWriter = closeWriter
    this.releaseWriter = releaseWriter
    this.closed = closed
  }
  get writable() {
    return this
  }

  getWriter() {
    return this.writer
  }

  /**
   * @param {string} name
   * @param {UnixFS.FileLink | UnixFS.DirectoryLink} link
   * @param {API.WriteOptions} [options]
   */

  write(name, link, options) {
    return write(this, name, link, options)
  }

  /**
   * @param {string} name
   */
  remove(name) {
    return remove(this, name)
  }

  /**
   * @param {object} [options]
   * @param {API.WritableBlockStream} [options.writable]
   * @param {boolean} [options.releaseLock]
   * @param {boolean} [options.preventClose]
   * @returns {API.DirectoryWriterView<Layout>}
   */
  fork(options) {
    return fork(this, options)
  }

  close() {
    return close(this, this.closeWriter, this.releaseWriter)
  }
}
