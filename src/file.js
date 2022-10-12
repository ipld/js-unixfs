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
 * @returns {API.EncoderSettings}
 */
export const defaults = () => ({
  chunker: FixedSize,
  fileChunkEncoder: UnixFSLeaf,
  smallFileEncoder: UnixFSLeaf,
  fileEncoder: UnixFS,
  fileLayout: Balanced.withWidth(174),
  hasher: sha256,
  linker: { createLink: CID.createV1 },
})

/**
 * @template {unknown} Layout
 * @param {Partial<API.EncoderSettings<Layout>>} config
 * @returns {API.EncoderSettings<Layout>}
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
 * @param {API.Options<Layout>} options
 * @returns {API.View<Layout>}
 */
export const create = ({ writer, metadata = {}, settings = defaults() }) =>
  new FileWriterView(Writer.init(writer, metadata, configure(settings)))

/**
 * @template T
 * @param {API.View<T>} view
 * @param {Uint8Array} bytes
 * @return {Promise<API.View<T>>}
 */

export const write = async (view, bytes) => {
  await perform(view, Task.send({ type: "write", bytes }))
  return view
}

/**
 * @template T
 * @param {API.View<T>} view
 * @param {API.CloseOptions} options
 */
export const close = async (
  view,
  { releaseLock = false, closeWriter = false } = {}
) => {
  await perform(view, Task.send({ type: "close" }))
  const { state } = view
  if (state.status === "linked") {
    if (closeWriter) {
      await view.state.writer.close()
    } else if (releaseLock) {
      view.state.writer.releaseLock()
    }
    return state.link
    /* c8 ignore next 5 */
  } else {
    panic(
      `Expected writer to be in 'linked' state after close, but it is in "${state.status}" instead`
    )
  }
}

/**
 * @template T
 * @param {API.View<T>} view
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
 * @implements {API.View<Layout>}
 */
class FileWriterView {
  /**
   * @param {Writer.State<Layout>} state
   */
  constructor(state) {
    this.state = state
  }
  get writer() {
    return this.state.writer
  }
  get settings() {
    return this.state.config
  }
  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<API.View<Layout>>}
   */
  write(bytes) {
    return write(this, bytes)
  }
  /**
   * @param {API.CloseOptions} [options]
   * @returns {Promise<UnixFS.FileLink>}
   */
  close(options) {
    return close(this, options)
  }
}
