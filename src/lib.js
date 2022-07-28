import * as API from "./api.js"
import * as File from "./file.js"
import * as Directory from "./directory.js"

export * from "./api.js"

export { encode, decode, NodeType, code } from "./codec.js"
export {
  create as createFileWriter,
  configure,
  defaults,
  UnixFSLeaf,
  UnixFSRawLeaf,
} from "./file.js"
export { create as createDirectoryWriter } from "./directory.js"

/**
 * @template [Layout=unknown]
 * @param {API.FileSystemWriterOptions<Layout>} options
 * @returns {API.FileSystemWriter<Layout>}
 */
export const createWriter = ({ writable, settings = File.defaults() }) =>
  new FileSystemWriter({
    writable,
    settings: settings,
  })

/**
 * @template [Layout=unknown]
 * @implemets {API.FileSystemWriter<Layout>}
 */
class FileSystemWriter {
  /**
   * @param {Required<API.FileSystemWriterOptions<Layout>>} options
   */
  constructor({ writable, settings }) {
    this.writer = writable.getWriter()

    this.settings = settings
  }

  /** @type {API.WritableBlockStream} */
  get writable() {
    return this
  }

  // Currently `getWriter` / `releaseLock` methods mimic `WritableStream` /
  // `WritableStreamDefaultWriter` APIs that allow multiple writers. Current
  // implementation will not allow writers across (worker) threads but support
  // for that could be added in the future e.g. `getWriter()` could create new
  // `TransformStream` and pipe blocks from `ReadableStream` into `this.writer`.
  getWriter() {
    return this.writer
  }

  /**
   * @template [L=unknown]
   * @param {API.WriterOptions<L|Layout>} [config]
   */
  createFileWriter({
    settings = this.settings,
    metadata = {},
    preventClose = true,
  } = {}) {
    return File.create(
      {
        writable: this.writable,
        settings,
        preventClose,
      },
      metadata
    )
  }

  /**
   * @template [L=unknown]
   * @param {API.WriterOptions<L|Layout>} [config]
   */
  createDirectoryWriter({
    settings = this.settings,
    preventClose = true,
    metadata = {},
  } = {}) {
    return Directory.create(
      {
        writable: this.writable,
        settings,
        preventClose,
      },
      metadata
    )
  }

  async close() {
    await this.writer.close()
  }
}
