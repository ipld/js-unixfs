import * as API from "./api.js"
import * as Channel from "./writer/channel.js"
import * as File from "./file.js"
import * as Directory from "./directory.js"
import * as UnixFS from "./codec.js"

/**
 * @template [Layout=unknown]
 * @param {API.FileWriterConfig<Layout>} [config]
 * @returns {API.Writer<Layout>}
 */
export const create = (config = File.defaults()) => {
  return new UnixFSWriter(Channel.createBlockChannel(), config)
}

/**
 * @template [Layout=unknown]
 */
class UnixFSWriter {
  /**
   * @param {API.Channel<UnixFS.Block>} channel
   * @param {API.FileWriterConfig<Layout>} config
   */
  constructor(channel, config) {
    this.config = config
    this.channel = channel
  }

  /**
   * @template [L=unknown]
   * @param {UnixFS.Metadata} [metadata]
   * @param {API.FileWriterConfig<L|Layout>} [config]
   */
  createFileWriter(metadata = {}, config = this.config) {
    return File.createWriter(metadata, this.writer, config)
  }

  /**
   * @template [L=unknown]
   * @param {UnixFS.Metadata} [metadata]
   * @param {API.FileWriterConfig<L|Layout>} [config]
   */
  createDirectoryWriter(metadata = {}, config = this.config) {
    return Directory.createWriter(this.writer, metadata, config)
  }

  get reader() {
    return this.channel.reader
  }
  get writer() {
    return this.channel.writer
  }
  close() {
    this.channel.writer.close()
  }
}
