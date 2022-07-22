import * as API from "./api.js"
import * as Channel from "./writer/channel.js"
import * as File from "./file.js"
import * as Writer from "./file/writer.js"
import * as Directory from "./directory.js"
import * as UnixFS from "./codec.js"

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
 * @param {API.FileSystemConfig<Layout>} config
 * @returns {API.FileSystemWriter<Layout>}
 */
export const createWriter = ({ writable, config = File.defaults() }) => {
  return new FileSystemWriter({
    readable: undefined,
    writer: writable.getWriter(),
    config,
  })
}

/**
 * @template [Layout=unknown]
 * @param {API.EncoderConfig<Layout>} [config]
 * @returns {API.FileSystem<Layout>}
 */
export const create = (config = File.defaults()) => {
  const { readable, writer } = Channel.createBlockChannel()
  return new FileSystem({ readable, writer, config })
}

export const createFile = ({
  config = File.defaults(),
  metadata = {},
  preventClose = false,
} = {}) => {
  const fs = create(config)

  const file = File.create(
    {
      writable: fs,
      config,
      preventClose,
    },
    metadata
  )

  return Object.assign(file, { blocks: fs.blocks })
}

export const createDirectory = ({
  config = File.defaults(),
  metadata = {},
  preventClose = false,
} = {}) => {
  const fs = create(config)
  const directory = Directory.create(
    {
      writable: fs,
      config,
      preventClose,
    },
    metadata
  )

  return Object.assign(directory, { blocks: fs.blocks })
}

/**
 * @template {ReadableStream<UnixFS.Block>|undefined} Readable
 * @template [Layout=unknown]
 */
class FileSystemWriter {
  /**
   * @param {object} options
   * @param {Readable} options.readable
   * @param {Channel.Writer<UnixFS.Block>} options.writer
   * @param {API.EncoderConfig<Layout>} options.config
   */
  constructor({ readable, writer, config }) {
    this.writer = writer

    this.readable = readable
    this.config = config
    this.preventClose = true
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
  releaseLock() {}

  /**
   * @template [L=unknown]
   * @param {API.WriterConfig<L|Layout>} [config]
   */
  createFileWriter({
    config = this.config,
    preventClose = this.preventClose,
    metadata = {},
  } = {}) {
    return File.create(
      {
        writable: this,
        config,
        preventClose,
      },
      metadata
    )
  }

  /**
   * @template [L=unknown]
   * @param {API.WriterConfig<L|Layout>} [config]
   */
  createDirectoryWriter({
    config = this.config,
    preventClose = this.preventClose,
    metadata = {},
  } = {}) {
    return Directory.create(
      {
        writable: this,
        config,
        preventClose,
      },
      metadata
    )
  }

  async close() {
    await this.writer.close()
  }
}

/**
 * @template [Layout=unknown]
 * @extends {FileSystemWriter<ReadableStream<UnixFS.Block>, Layout>}
 * @implements {API.FileSystem<Layout>}
 */
class FileSystem extends FileSystemWriter {
  /**
   * @type {AsyncIterableIterator<UnixFS.Block>}
   */
  get blocks() {
    return blocks(this)
  }
}

/**
 * @param {API.FileSystem} fs
 */

export const blocks = async function* ({ readable }) {
  const reader = readable.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        break
      } else {
        yield next.value
      }
    }
  } finally {
    reader.releaseLock()
  }
}
