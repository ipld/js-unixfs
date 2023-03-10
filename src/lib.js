import * as API from "./api.js"
import * as File from "./file.js"
import * as Directory from "./directory.js"

export * from "./api.js"

export { encode, decode, NodeType, code } from "./codec.js"
export {
  create as createFileWriter,
  close as closeFile,
  write,
  configure,
  defaults,
  UnixFSLeaf,
  UnixFSRawLeaf,
} from "./file.js"
export {
  create as createDirectoryWriter,
  close as closeDirectory,
  fork as forkDirectory,
  set,
  remove,
} from "./directory.js"
export {
  create as createShardedDirectoryWriter,
  close as closeShardedDirectory,
  fork as forkShardedDirectory,
} from "./sharded-directory.js"

/**
 * @template [Layout=unknown]
 * @param {API.Options<Layout>} options
 * @returns {API.View<Layout>}
 */
export const createWriter = ({ writable, settings = File.defaults() }) =>
  new FileSystemWriter({
    writer: writable.getWriter(),
    settings,
  })

/**
 * @template {{writer:API.BlockWriter}} View
 * @param {View} view
 * @param {API.CloseOptions} options
 */
export const close = async (
  view,
  { releaseLock = true, closeWriter = true } = {}
) => {
  if (closeWriter) {
    await view.writer.close()
  } else if (releaseLock) {
    view.writer.releaseLock()
  }

  return view
}

/**
 * @template [Layout=unknown]
 * @implemets {API.View<Layout>}
 */
class FileSystemWriter {
  /**
   * @param {object} options
   * @param {API.BlockWriter} options.writer
   * @param {Partial<API.EncoderSettings<Layout>>} options.settings
   */
  constructor({ writer, settings }) {
    this.writer = writer
    this.settings = File.configure(settings)
  }

  /**
   * @template [L=unknown]
   * @param {API.WriterOptions<L|Layout>} config
   */
  createFileWriter({ settings = this.settings, metadata } = {}) {
    return File.create({
      writer: this.writer,
      settings,
      metadata,
    })
  }

  /**
   * @template [L=unknown]
   * @param {API.WriterOptions<L|Layout>} config
   */
  createDirectoryWriter({ settings = this.settings, metadata } = {}) {
    return Directory.create({
      writer: this.writer,
      settings,
      metadata,
    })
  }

  /**
   * @param {API.CloseOptions} [options]
   */
  close(options) {
    return close(this, options)
  }
}

// BlockSizeLimit specifies the maximum size an imported block can have.
// @see https://github.com/ipfs/go-unixfs/blob/68c015a6f317ed5e21a4870f7c423a4b38b90a96/importer/helpers/helpers.go#L7-L8
export const BLOCK_SIZE_LIMIT = 1048576 // 1 MB
export const defaultCapacity = BLOCK_SIZE_LIMIT * 100

/**
 * Creates `QueuingStrategy` that can fit blocks with total size up to given
 * byteLength.
 *
 * @param {number} byteLength
 * @returns {Required<QueuingStrategy<API.Block>>}
 */
export const withCapacity = (byteLength = defaultCapacity) => ({
  highWaterMark: byteLength,
  size: block => block.bytes.length,
})
