import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
export * from "./directory/api.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @template [Layout=unknown]
 * @param {API.DirectoryConfig<Layout>} config
 * @param {API.Metadata} metadata
 * @returns {API.DirectoryWriterView<Layout>}
 */
export const create = (
  { writable, preventClose = true, config = defaults() },
  metadata = {}
) =>
  new DirectoryWriter(
    writable.getWriter(),
    metadata,
    config,
    new Map(),
    true,
    preventClose
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
      `Directory entry name "${name}" contains forbidden '/' character`
    )
  }
  if (!overwrite && writable.entries.has(name)) {
    throw new Error(`Diretroy already contains entry with name "${name}"`)
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
  if (writer.writable) {
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
export const close = async (state, preventClose = false) => {
  const { writer, config, entries, metadata } = asWritable(state)
  state.writable = false
  const links = [...entries.values()]
  const node = UnixFS.createFlatDirectory(links, metadata)
  const bytes = UnixFS.encodeDirectory(node)
  const digest = await config.hasher.digest(bytes)
  const cid = config.createCID(UnixFS.code, digest)
  await writer.write({ cid, bytes })
  if (preventClose) {
    writer.releaseLock()
  } else {
    await writer.close()
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
 * @param {API.WritableBlockStream} [writable]
 * @returns {API.DirectoryWriterView<L>}
 */
export const fork = (
  { writer, metadata, config, entries, preventClose },
  writable
) =>
  new DirectoryWriter(
    writable ? writable.getWriter() : writer,
    metadata,
    config,
    new Map(entries.entries()),
    true,
    preventClose
  )

/**
 * @template [Layout=unknown]
 * @implements {API.DirectoryWriterView<Layout>}
 */
class DirectoryWriter {
  /**
   * @param {API.BlockWriter} writer
   * @param {UnixFS.Metadata} metadata
   * @param {API.EncoderConfig<Layout>} config
   * @param {Map<string, UnixFS.DirectoryEntryLink>} entries
   * @param {boolean} writable
   * @param {boolean} preventClose
   */
  constructor(writer, metadata, config, entries, writable, preventClose) {
    this.writer = writer
    this.metadata = metadata
    this.config = config
    this.entries = entries
    this.preventClose = preventClose
    this.writable = writable
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
   * @param {API.WritableBlockStream} [writable]
   * @returns {API.DirectoryWriterView<Layout>}
   */
  fork(writable) {
    return fork(this, writable)
  }

  close() {
    return close(this, this.preventClose)
  }
}
