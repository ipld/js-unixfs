import * as API from "./api.js"
import * as Channel from "./writer/channel.js"
import * as File from "./file.js"
import * as Writer from "./file/writer.js"
import * as Directory from "./directory.js"
import * as UnixFS from "./codec.js"

export { encode, decode, NodeType } from "./codec.js"
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
 * @param {API.Writer<UnixFS.Block>} writer
 * @param {API.FileWriterConfig<Layout>} [config]
 * @returns {API.FileSystemWriter<Layout>}
 */
export const createWriter = (writer, config = File.defaults()) => {
  return new UnixFSWriter(writer, config)
}

/**
 * @template [Layout=unknown]
 * @param {API.FileWriterConfig<Layout>} [config]
 */
export const create = (config = File.defaults()) => {
  const { readable, writer } = Channel.createBlockChannel()
  return { blocks: readable, writer: createWriter(writer, config) }
}

export const createFile = ({
  config = File.defaults(),
  metadata = {},
} = {}) => {
  const { blocks, writer } = create(config)
  const file = File.create({
    writer: writer.writer,
    metadata,
    config,
    preventClose: false,
  })

  return { file, writer, blocks }
}

export const createDirectory = ({
  config = File.defaults(),
  metadata = {},
} = {}) => {
  const { blocks, writer } = create(config)
  const directory = Directory.create({
    writer: writer.writer,
    metadata,
    config,
    preventClose: false,
  })

  return { directory, writer, blocks }
}

/**
 * @template [Layout=unknown]
 * @implements {API.BlockWriter}
 * @implements {API.FileSystemWriter<Layout>}
 */
class UnixFSWriter {
  /**
   * @param {Channel.Writer<UnixFS.Block>} writer
   * @param {API.FileWriterConfig<Layout>} config
   */
  constructor(writer, config) {
    this.config = config
    this.preventClose = true
    this.writer = writer
  }

  get desiredSize() {
    return this.writer.desiredSize
  }

  get ready() {
    return this.writer.ready
  }

  /**
   * @param {UnixFS.Block} block
   */
  write(block) {
    return this.writer.write(block)
  }

  /**
   * @param {Error} reason
   */
  abort(reason) {
    return this.writer.abort(reason)
  }

  /**
   * @template [L=unknown]
   * @param {UnixFS.Metadata} [metadata]
   * @param {API.FileWriterConfig<L|Layout>} [config]
   */
  createFileWriter(metadata = {}, config = this.config) {
    return File.create({
      writer: this.writer,
      metadata,
      config,
      preventClose: true,
    })
  }

  /**
   * @template [L=unknown]
   * @param {UnixFS.Metadata} [metadata]
   * @param {API.FileWriterConfig<L|Layout>} [config]
   */
  createDirectoryWriter(metadata = {}, config = this.config) {
    return Directory.create({
      writer: this.writer,
      metadata,
      config,
      preventClose: true,
    })
  }

  async close() {
    await this.writer.close()
  }
}
