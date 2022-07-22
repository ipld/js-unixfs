import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
export * from "./directory/api.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @template [Layout=unknown]
 * @param {object} options
 * @param {API.BlockWriter} options.writer
 * @param {UnixFS.Metadata} [options.metadata]
 * @param {API.FileWriterConfig<Layout>} [options.config]
 * @param {boolean} [options.preventClose]
 * @returns {API.DirectoryWriterView<Layout>}
 */
export const create = ({
  writer,
  metadata = {},
  config = defaults(),
  preventClose = false,
}) => new DirectoryWriter(writer, metadata, config, new Map(), preventClose)

/**
 * @template {API.State} Writer
 * @param {Writer} writer
 * @param {string} name
 * @param {UnixFS.FileLink | UnixFS.DirectoryLink} link
 * @param {API.WriteOptions} [options]
 * @returns {Writer}
 */
export const write = (writer, name, link, { overwrite = false } = {}) => {
  if (name.includes("/")) {
    throw new Error(
      `Directory entry name "${name}" contains forbidden '/' character`
    )
  }
  if (!overwrite && writer.entries.has(name)) {
    throw new Error(`Diretroy already contains entry with name "${name}"`)
  } else {
    const { cid, dagByteLength } = link
    writer.entries.set(name, { name, cid, dagByteLength })
    return writer
  }
}

/**
 * @template {API.State} Writer
 * @param {Writer} writer
 * @param {string} name
 * @returns {Writer}
 */
export const remove = (writer, name) => {
  writer.entries.delete(name)
  return writer
}

/**
 * @template Layout
 * @param {API.State<Layout>} state
 * @returns {Promise<UnixFS.DirectoryLink>}
 */
export const close = async (
  { writer, config, entries, metadata },
  preventClose = false
) => {
  const links = [...entries.values()]
  const node = UnixFS.createFlatDirectory(links, metadata)
  const bytes = UnixFS.encodeDirectory(node)
  const digest = await config.hasher.digest(bytes)
  const cid = config.createCID(UnixFS.code, digest)
  await writer.write({ cid, bytes })
  if (!preventClose) {
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
 * @param {Writer} writer
 * @returns {API.DirectoryWriterView<L>}
 */
export const fork = ({ writer, metadata, config, entries, preventClose }) =>
  new DirectoryWriter(
    writer,
    metadata,
    config,
    new Map(entries.entries()),
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
   * @param {API.FileWriterConfig<Layout>} config
   * @param {Map<string, UnixFS.DirectoryEntryLink>} entries
   * @param {boolean} preventClose
   */
  constructor(writer, metadata, config, entries, preventClose) {
    this.writer = writer
    this.metadata = metadata
    this.config = config
    this.entries = entries
    this.preventClose = preventClose
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
   * @returns {API.DirectoryWriterView<Layout>}
   */
  fork() {
    return fork(this)
  }

  close() {
    return close(this, this.preventClose)
  }
}
