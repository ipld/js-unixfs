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
 * @returns {API.EncoderConfig}
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
 * @template {unknown} Layout
 * @param {Partial<API.EncoderConfig<Layout>>} config
 * @returns {API.EncoderConfig<Layout>}
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
 * @param {API.FileWriterConfig<Layout>} options
 * @param {UnixFS.Metadata} [metadata]
 * @returns {API.FileWriter<Layout>}
 */
export const create = (
  { writable, preventClose = true, config = defaults() },
  metadata = {}
) =>
  new FileWriterView(
    Writer.init(writable.getWriter(), metadata, configure(config)),
    !preventClose
  )

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
 */
export const close = async (view, closeWriter = false) => {
  await perform(view, Task.send({ type: "close" }))
  const { state } = view
  if (state.status === "linked") {
    if (closeWriter) {
      await view.state.writer.close()
    } else {
      await view.state.writer.releaseLock()
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
   * @param {boolean} closeWriter
   */
  constructor(state, closeWriter) {
    this.state = state
    this.closeWriter = closeWriter
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
    return close(this, this.closeWriter)
  }
}
