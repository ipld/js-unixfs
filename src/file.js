import * as API from "./file/api.js"
import * as UnixFS from "./codec.js"
import * as Writer from "./file/writer.js"
import * as Task from "actor"
import { panic } from "./writer/util.js"
import * as FixedSize from "./file/chunker/fixed.js"
import { sha256 } from "multiformats/hashes/sha2"
import { CID } from "multiformats/cid"
import * as Balanced from "./file/layout/balanced.js"

export * from "./file/api.js"

/**
 * @returns {API.FileWriterConfig}
 */
export const defaults = () => ({
  chunker: FixedSize,
  fileChunkEncoder: UnixFSLeaf,
  smallFileEncoder: UnixFSLeaf,
  fileEncoder: UnixFS,
  fileLayout: Balanced.withWidth(174),
  hasher: sha256,
  createCID: CID.createV1,
})

/**
 * @param {Partial<API.FileWriterConfig>} config
 * @returns {API.FileWriterConfig}
 */
export const configure = config => ({
  ...defaults(),
  ...config,
})

export const UnixFSLeaf = {
  code: UnixFS.code,
  name: UnixFS.name,
  encode: UnixFS.encodeFileChunk,
}

export const UnixFSRawLeaf = {
  code: UnixFS.code,
  name: UnixFS.name,
  encode: UnixFS.encodeRaw,
}

/**
 * @template Layout
 * @param {object} options
 * @param {API.BlockWriter} options.writer
 * @param {UnixFS.Metadata} [options.metadata]
 * @param {API.FileWriterConfig<Layout>} [options.config]
 * @param {boolean} [options.preventClose]
 * @returns {API.FileWriter<Layout>}
 */
export const create = ({
  writer,
  metadata = {},
  config = defaults(),
  preventClose = false,
}) => {
  return new FileWriterView(Writer.init(writer, metadata, config), preventClose)
}

/**
 * @template T
 * @param {API.FileWriter<T>} view
 * @param {Uint8Array} bytes
 * @return {Promise<API.FileWriter<T>>}
 */

export const write = async (view, bytes) => {
  await perform(view, Task.send({ type: "write", bytes }))
  return view
}

/**
 * @template T
 * @param {API.FileWriter<T>} view
 * @param {boolean} preventClose
 */
export const close = async (view, preventClose) => {
  await perform(view, Task.send({ type: "close" }))
  const { state } = view
  if (state.status === "linked") {
    if (!preventClose) {
      await view.state.writer.close()
    }
    return state.link
  } else {
    panic(
      `Expected writer to be in 'linked' state after close, but it is in "${state.status}" instead`
    )
  }
}

/**
 * @template T
 * @param {API.FileWriter<T>} view
 * @param {Task.Effect<Writer.Message>} effect
 */
const perform = (view, effect) =>
  Task.fork(
    Task.loop(effect, message => {
      const { state, effect } = Writer.update(message, view.state)
      view.state = state
      return effect
    })
  )

/**
 * @template Layout
 * @implements {API.FileWriter<Layout>}
 */
class FileWriterView {
  /**
   * @param {Writer.State<Layout>} state
   * @param {boolean} preventClose
   */
  constructor(state, preventClose) {
    this.state = state
    this.preventClose = preventClose
  }
  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<API.FileWriter<Layout>>}
   */
  write(bytes) {
    return write(this, bytes)
  }
  /**
   * @returns {Promise<UnixFS.FileLink>}
   */
  close() {
    return close(this, this.preventClose)
  }
}
