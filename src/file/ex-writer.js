import * as UnixFS from "../lib.js"
import * as Channel from "../writer/channel.js"
import { sha256 } from "multiformats/hashes/sha2"
import * as Raw from "multiformats/codecs/raw"
import { CID } from "multiformats/cid"
import * as FixedSize from "./chunker/fixed.js"
import * as Balanced from "./layout/balanced.js"
import * as Layout from "./layout.js"
import * as Chunker from "./chunker.js"
import * as Task from "actor"
import * as API from "./api.js"
import { EMPTY, EMPTY_BUFFER, unreachable, defer } from "../writer/util.js"

/**
 * @param {UnixFS.Metadata} metadata
 * @param {Channel.Queue<UnixFS.Block>} blockQueue
 * @param {API.FileWriterConfig} options
 * @returns {API.FileView}
 */
export const openFileWriter = (metadata, blockQueue, options) => {
  const service = { ...options, blockQueue }

  return {
    state: {
      type: "file",
      status: "open",
      metadata,
      service,
      chunker: Chunker.open({ chunker: service.chunker }),
      layout: Layout.open(metadata, service),
      writing: false,
    },
  }
}

export const UnixFSLeaf = {
  code: UnixFS.code,
  name: UnixFS.name,
  encode: UnixFS.encodeFileChunk,
}

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
 * @param {UnixFS.Metadata} [metadata]
 * @param {API.FileWriterConfig} [options]
 */
export const create = (metadata = {}, options = defaults()) => {
  const { reader, writer } = Channel.createBlockChannel()

  return {
    blocks: reader,
    writer: openFileWriter(metadata, writer, options),
  }
}

/**
 * @param {API.FileView} self
 * @param {Uint8Array} bytes
 */
export const write = async (self, bytes) => {
  const { state, fx } = writeBytes(self.state, bytes)
  self.state = state
  await Task.fork(
    loop(fx, message => {
      const { state, fx } = update(self.state, message)
      self.state = state
      return fx
    })
  )
}

/**
 * @param {API.FileView} self
 */
export const close = self => {
  const { state } = self
  switch (state.status) {
    case "open": {
      const { service } = state
      if (state.buffer.byteLength > 0) {
        state.chunks.push(state.buffer)
      }

      self.state = {
        service,
        type: "file",
        status: "closed",
        chunks: state.chunks,
        metadata: state.metadata,
        layoutState: state.layoutState,
        writing: state.writing,
      }

      if (!state.writing) {
        self.state.writing = true
        Task.spawn(performWrite(self))
      }
    }
    default:
      throw new Error(`File is no longer open ${self.state.status}`)
  }
}

/**
 * @param {Chunker.Chunker} chunker
 * @param {Uint8Array} input
 * @returns {{buffer:Uint8Array, chunks:Uint8Array[]}}
 */

const split = (input, chunker) => {
  let buffer = input
  /** @type {Uint8Array[]} */
  const chunks = []
  const sizes = chunker.cut(chunker.context, buffer)
  let offset = 0
  for (const size of sizes) {
    const chunk = buffer.subarray(offset, offset + size)
    chunks.push(chunk)
    offset += size
  }
  buffer = buffer.subarray(offset)

  return { buffer, chunks }
}

/**
 * Note: Concurrent calls to this function are problematic so do not do that!
 *
 * @param {API.FileView} self
 */
export const performWrite = function* (self) {
  while (true) {
    let { state } = self
    switch (state.status) {
      case "open":
      case "closed": {
        const { service } = state
        let { readerState, layoutState } = state
        if (state.chunks.length > 0) {
          // Remove all the chunks
          const chunks = state.chunks.splice(0)
          const result = writeChunks(readerState, service, chunks)

          for (const node of result.nodes) {
            const { block, link } = yield* Task.wait(node)
            service.blockQueue.enqueue(block)
            layoutState = Layout.write(layoutState, [link])
          }
          self.state = { ...self.state, layoutState, readerState }
        } else {
          if (state.status === "closed") {
          }

          self.state = {
            ...state,
            writing: false,
            layoutState,
            readerState,
          }
          return
        }
        break
      }
      default: {
        throw new Error(
          `write loop encountered unexpected ${state.status} state`
        )
      }
    }
  }
}

/**
 * @typedef {never
 * |{type:"write", bytes:Uint8Array}
 * |{type:"leaf", leaf:API.EncodedFile}
 * |{type:"layout", layout:Layout.Message}
 * |{type:"block"}
 * |{type:"close"}
 * |{type:"root", root:API.EncodedFile}
 * |{type:"flush"}
 * } Message
 *
 * @typedef {{
 * state: API.FileState
 * fx:Task.Effect<Message>
 * }} Update
 *
 *
 * @param {API.FileState} state
 * @param {Message} message
 * @returns {Update}
 */
const update = (state, message) => {
  switch (message.type) {
    case "write": {
      return writeBytes(state, message.bytes)
    }
    case "leaf": {
      return addLeaf(state, message.leaf)
    }
    case "root": {
      return updateRoot(state, message.root)
    }
    case "layout": {
      return updateLayout(state, message.layout)
    }
    case "close": {
      return closeWriter(state)
    }
    case "flush": {
      return flushWriter(state)
    }
    default: {
      return unreachable`Can not process unknown message ${message}`
    }
  }
}

/**
 * @template O, S
 * @param {API.FileWriterService<O, S>} service
 * @param {API.FileContent} file
 */
function* writeFile(service, file) {
  const stream = file.stream()
  const reader = stream.getReader()
  let chunkerState = Chunker.open({ chunker: service.chunker })
  let layoutState = service.fileLayout.open(service.fileLayout.options)

  let ls = Layout.open(file, service)

  /** @type {Record<number, API.Defer<UnixFS.FileLink>|UnixFS.FileLink>} */

  let links = {}
  // let layoutState = Layout.open(
  //   file,
  //   service.fileLayout.open(service.fileLayout.options)
  // )

  while (true) {
    const readState = yield* Task.wait(reader.read())
    if (readState.done) {
      const result = Chunker.close(chunkerState)
      if (result.single) {
        const bytes = service.smallFileEncoder.encode(result.chunk)
        const hash = yield* Task.wait(service.hasher.digest(bytes))
        const cid = service.createCID(service.fileEncoder.code, hash)
        const block = { bytes, cid }
        service.blockQueue.enqueue(block)
        return {
          cid,
          contentByteLength: result.chunk.byteLength,
          dagByteLength: bytes.byteLength,
        }
      } else {
        const leafEncoders = yield* encodeLeaves(service, result.chunks)
        const branchEncoders = []
        for (const fork of leafEncoders) {
          const { block, link } = yield* Task.join(fork)
          // Send a block out.
          service.blockQueue.enqueue(block)

          // Pass a new leaf to a layout engine.
          // const layout = service.fileLayout.write(layoutState, [leaf.link])
          // layoutState = layout.state
          const layout = Layout.appendLeaf(ls, link)
          ls = layout.state
          for (const task of layout.tasks) {
            branchEncoders.push(yield* Task.fork(task))
          }
        }

        const {
          state,
          tasks: { root, nodes },
        } = Layout.close2(ls)

        for (const fork of nodes) {
          for (const task of nodes) {
            branchEncoders.push(yield* Task.fork(task))
          }
        }

        for (const fork of branchEncoders) {
          const { id, block, link } = yield* Task.join(fork)
          service.blockQueue.enqueue(block)
          ls = Layout.linkNode(ls, id, link)
        }

        const { block, link } = yield* root
        service.blockQueue.enqueue(block)
        return link
      }
    } else {
      const chunker = Chunker.append(chunkerState, readState.value)
      const chunks = Chunker.chunks(chunker)
      chunkerState = Chunker.state(chunker)

      // Fork concurrent lead node encode task per each chunk.
      const leafEncoders = yield* encodeLeaves(service, chunks)

      // Process link encode tasks one by one in the order we scheduled them
      // (order of their completion may be different)
      const branchEncoders = []

      for (const task of leafEncoders) {
        const { link, block } = yield* Task.join(task)
        // Send a block out.
        service.blockQueue.enqueue(block)
        const layout = Layout.appendLeaf(ls, link)
        ls = layout.state
        for (const task of layout.tasks) {
          const fork = yield* Task.fork(task)
          branchEncoders.push(fork)
        }
      }

      for (const task of branchEncoders) {
        const branch = yield* Task.join(task)
        service.blockQueue.enqueue(branch.block)
        Layout.link(links, branch.id, branch.link)
      }
    }
  }
}

/**
 * @template O, S
 * @param {API.FileWriterService<O, S>} service
 * @param {Uint8Array[]} chunks
 */
function* encodeLeaves(service, chunks) {
  // Fork concurrent lead node encode task per each chunk.
  const forks = []
  for (const chunk of chunks) {
    const task = encodeLeaf(service, chunk, service.fileChunkEncoder)
    const fork = yield* Task.fork(task)
    forks.push(fork)
  }
  return forks
}

/**
 * @template O, S
 * @param {API.FileWriterService<O, S>} service
 * @param {*} leaves
 */
function* encodeBranches(service, leaves) {
  for (const task of leaves) {
    const leaf = yield* Task.join(task)
    // Send a block out.
    service.blockQueue.enqueue(leaf.block)

    // Pass a new leaf to a layout engine.
    const layout = service.fileLayout.write(layoutState, [leaf.link])
    layoutState = layout.state

    // For each leayout node we fork a concurrent blanch encode task
    for (const node of layout.nodes) {
      links[node.id] = defer()
      const children = node.children.map(child =>
        typeof child === "number" ? Layout.unlink(links, child) : child
      )

      const task = Layout.encodeNode(service, node.id, children)
      const fork = yield* Task.fork(task)
      branchEncoders.push(fork)
    }

    for (const task of branchEncoders) {
      const branch = yield* Task.join(task)
      service.blockQueue.enqueue(branch.block)
      Layout.link(links, branch.id, branch.link)
    }
  }
}
/**
 *
 * @param {API.FileState} state
 * @param {API.FileContent} content
 */
const writeFileContent = (state, content) => {
  switch (state.status) {
    case "open": {
      const reader = content.stream().getReader()
      const read = reader.read()
    }
  }
}

/**
 * @param {API.FileState} state
 * @param {Uint8Array} bytes
 * @returns {Update}
 */
const writeBytes = (state, bytes) => {
  switch (state.status) {
    case "open": {
      const { service } = state
      const chunker = Chunker.append(state.chunker, bytes)
      const chunks = Chunker.chunks(chunker)

      return {
        state: { ...state, chunker: Chunker.state(chunker) },
        fx:
          chunks.length > 0
            ? Task.listen({ leaf: buildLeaves(service, chunks) })
            : Task.none(),
      }
    }
    default:
      return unreachable`Can not write to file, it is not open`
  }
}

/**
 * @param {API.FileState} state
 * @param {Layout.Message} message
 * @returns {Update}
 */
const updateLayout = (state, message) => {
  switch (state.status) {
    case "open":
    case "closed": {
      const layout = Layout.update(state.layout, message)
      return {
        state: { ...state, layout: Layout.state(layout) },
        fx: Task.listen({ layout: Layout.effect(layout) }),
      }
    }
    default:
      return unreachable`Can not update layout when file state is linked`
  }
}

/**
 *
 * @param {API.FileState} state
 * @param {API.EncodedFile} leaf
 * @returns {Update}
 */
const addLeaf = (state, leaf) => {
  switch (state.status) {
    case "open":
    case "closed": {
      const { service } = state
      const layout = Layout.addLeaf(state.layout, leaf.link)

      return {
        state: { ...state, layout: Layout.state(layout) },
        fx: Task.listen({
          block: Layout.enqueue(service, leaf.block),
          layout: Layout.effect(layout),
        }),
      }
    }
    default:
      return unreachable`Can change file layout when file state is linked`
  }
}

/**
 * @param {API.FileState} state
 * @returns {Update}
 */
const closeWriter = state => {
  switch (state.status) {
    case "open": {
      const { service, ...open } = state
      const chunker = Chunker.close(state.chunker)
      if (chunker.single) {
        return {
          state: {
            ...open,
            status: "closed",
            service,
          },
          fx: Task.listen({
            root: Task.effect(
              encodeLeaf(service, chunker.chunk, service.smallFileEncoder)
            ),
          }),
        }
      } else {
        return {
          state: {
            ...open,
            status: "closed",
            service,
          },
          // TODO: Once leaves are received we need to close the layout
          fx:
            chunker.chunks.length > 0
              ? (function* () {
                  const out = Task.listen({
                    leaf: buildLeaves(service, chunker.chunks),
                  })
                  yield* out
                  yield* Task.send({ type: "flush" })
                })()
              : Task.none(),
        }
      }
    }
    default:
      return unreachable`Can not close file when file state is not open`
  }
}

/**
 * @param {API.FileState} state
 * @returns {Update}
 */
const flushWriter = state => {
  switch (state.status) {
    case "closed": {
      const { service } = state
      const layout = Layout.close(layout.state)
    }
    default:
      return unreachable`Can not flush file unless it's closed`
  }
}

/**
 * @param {API.FileState} state
 * @param {API.FileLeaf} root
 * @returns {Update}
 */
const updateRoot = (state, root) => {
  switch (state.status) {
    case "closed": {
      return {
        state: {
          type: "file",
          status: "linked",
          state: root.link,
        },
        fx: Layout.enqueue(state.service, root.block),
      }
    }
    default:
      return unreachable`Can not set root on file unless it's closed`
  }
}

/**
 * @param {API.FileWriterService} service
 * @param {Uint8Array[]} chunks
 * @returns {Task.Effect<API.EncodedFile>}
 */
const buildLeaves = function* (service, chunks) {
  const { fileChunkEncoder: encoder } = service
  const tasks = []
  for (const chunk of chunks) {
    const task = yield* Task.fork(encodeLeaf(service, chunk, encoder))
    tasks.push(task)
  }

  for (const task of tasks) {
    const leaf = yield* Task.join(task)
    yield* Task.send(leaf)
  }
}

/**
 * @param {API.FileWriterService} service
 * @param {Uint8Array} chunk
 */
const makeLeafNode = (service, chunk) =>
  Task.promise(encodeLeaf(service, chunk, service.fileChunkEncoder))

/**
 * @param {API.FileView} self
 */
const end = function* (self) {
  let { state } = self
  switch (state.status) {
    case "open": {
      const { readerState, service } = state
      const result = writeChunks(self, [state.buffer])
      state = result.state
      const { layoutState } = state
      switch (state.readerState.status) {
        case "first": {
          const { block, link } = yield* encodeLeaf(
            self,
            EMPTY_BUFFER,
            state.service.smallFileEncoder
          )
          service.blockQueue.enqueue(block)
          return { type: "file", status: "linked", link }
        }
        case "second": {
          const { block, link } = yield* encodeLeaf(
            self,
            readerState.first,
            state.service.smallFileEncoder
          )
          service.blockQueue.enqueue(block)
          return { type: "file", status: "linked", link }
        }
        default: {
          const link = yield* Layout.end(layoutState)
          return { type: "file", status: "linked", link }
        }
      }
    }
    default:
      throw new Error(`File is not open, it is ${state.status}`)
  }
}

/**
 * @param {API.FileWriterService} service
 * @param {Uint8Array} chunk
 * @param {API.FileChunkEncoder} encoder
 * @returns {Task.Task<API.EncodedFile, never>}
 */
const encodeLeaf = function* ({ hasher, createCID }, chunk, encoder) {
  const bytes = encoder.encode(chunk)
  const hash = yield* Task.wait(hasher.digest(bytes))
  const cid = createCID(encoder.code, hash)

  const block = { cid, bytes }
  const link = {
    cid,
    contentByteLength: chunk.byteLength,
    dagByteLength: bytes.byteLength,
  }

  return { id: -1, block, link }
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 */

const concat = (left, right) => {
  if (left.byteLength === 0) {
    return right
  } else if (right.byteLength === 0) {
    return left
  } else {
    const join = new Uint8Array(left.byteLength + right.byteLength)
    join.set(left, 0)
    join.set(right, left.byteLength)
    return join
  }
}

write(file, Buffer.from("hello there how are you my friend")) //=
write(file, Buffer.from("some more data for you please take it!"))
write(file, Buffer.from("I've got nothing else to say"))
write(
  file,
  Buffer.from("but I'm going to keep saying things to write more data here")
)
write(file, Buffer.from("hello there how are you my friend")) //=
write(file, Buffer.from("some more data for you please take it!"))
write(file, Buffer.from("I've got nothing else to say"))
write(
  file,
  Buffer.from("but I'm going to keep saying things to write more data here")
)

file.state.layoutState // ?

const blocks = channel.reader.getReader()
blocks.read()

close(file)

export { file }
