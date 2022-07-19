import * as API from "./directory/api.js"
import * as File from "./file.js"
import * as UnixFS from "./codec.js"
export * from "./directory/api.js"

export const configure = File.configure
export const defaults = File.defaults

/**
 * @typedef {Map<string, UnixFS.DirectoryEntryLink>} State
 */

/**
 * @template [Layout=unknown]
 * @param {API.BlockQueue} blockQueue
 * @param {UnixFS.Metadata} [metadata]
 * @param {API.FileWriterConfig<Layout>} [config]
 * @returns {API.DirectoryWriter}
 */
export const createWriter = (blockQueue, metadata = {}, config = defaults()) =>
  new DirectoryWriterView(blockQueue, metadata, config)

/**
 * @template [Layout=unknown]
 * @implements {API.DirectoryWriter}
 */
class DirectoryWriterView {
  /**
   * @param {API.BlockQueue} blockQueue
   * @param {UnixFS.Metadata} metadata
   * @param {API.FileWriterConfig<Layout>} config
   */
  constructor(blockQueue, metadata, config) {
    this.blockQueue = blockQueue
    this.metadata = metadata
    this.config = config
    /** @type {State} */
    this.state = new Map()
  }

  /**
   * @param {API.DirectoryEntry} entry
   */

  write({ name, link }) {
    if (name.includes("/")) {
      throw new Error(
        `Directory entry name "${name}" contains forbidden '/' character`
      )
    }
    if (this.state.has(name)) {
      throw new Error(`Diretroy already contains entry with name "${name}"`)
    } else {
      const { cid, dagByteLength } = link
      this.state.set(name, { name, cid, dagByteLength })
      return this
    }
  }

  close() {
    return close(this)
  }
}

/**
 * @param {object} self
 * @param {State} self.state
 * @param {UnixFS.Metadata} self.metadata
 * @param {API.FileWriterConfig} self.config
 * @return {Promise<UnixFS.DirectoryLink>}
 */

export const close = async ({ state, metadata, config }) => {
  const node = UnixFS.createFlatDirectory([...state.values()], metadata)
  const bytes = UnixFS.encodeDirectory(node)
  const digest = await config.hasher.digest(bytes)
  const cid = config.createCID(UnixFS.code, digest)
  return { cid, dagByteLength: bytes.byteLength }
}
