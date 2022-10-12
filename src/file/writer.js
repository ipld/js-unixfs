import * as Task from "actor"
import * as API from "./api.js"
import * as Layout from "./layout/api.js"
import * as UnixFS from "../codec.js"
import * as Chunker from "./chunker.js"
import { EMPTY_BUFFER, panic, unreachable } from "../writer/util.js"
import * as Queue from "./layout/queue.js"

/**
 * @template Layout
 * @typedef {{
 * readonly status: 'open'
 * readonly metadata: UnixFS.Metadata
 * readonly config: API.EncoderSettings<Layout>
 * readonly writer: API.BlockWriter
 * chunker: Chunker.Chunker
 * layout: Layout
 * nodeQueue: Queue.Queue
 * }} Open
 */
/**
 * @template Layout
 * @typedef {{
 * readonly status: 'closed'
 * readonly metadata: UnixFS.Metadata
 * readonly config: API.EncoderSettings<Layout>
 * readonly writer: API.BlockWriter
 * readonly rootID: Layout.NodeID
 * readonly end?: Task.Fork<void, never>
 * chunker?: null
 * layout?: null
 * nodeQueue: Queue.Queue
 * }} Closed
 */
/**
 * @template Layout
 * @typedef {{
 * readonly status: 'linked'
 * readonly metadata: UnixFS.Metadata
 * readonly config: API.EncoderSettings<Layout>
 * readonly writer: API.BlockWriter
 * readonly link: Layout.Link
 * chunker?: null
 * layout?: null
 * nodeQueue: Queue.Queue
 * }} Linked
 */

/**
 * @template Layout
 * @typedef {Open<Layout>|Closed<Layout>|Linked<Layout>} State
 */

/**
 * @template {object} Layout
 * @typedef {{
 * state: State<Layout>
 * effect: Task.Effect<Message>
 * }} Update
 */
/**
 * @typedef {never
 * |{type:"write", bytes:Uint8Array}
 * |{type:"link", link:API.EncodedFile}
 * |{type:"block"}
 * |{type: "close"}
 * |{type: "end"}
 * } Message
 */

/**
 * @template Layout
 * @param {Message} message
 * @param {State<Layout>} state
 */
export const update = (message, state) => {
  switch (message.type) {
    case "write":
      return write(state, message.bytes)
    case "link":
      return link(state, message.link)
    /* c8 ignore next 2 */
    case "block":
      return { state, effect: Task.none() }
    case "close":
      return close(state)
    case "end":
      return { state, effect: Task.none() }
    default:
      return unreachable`File Writer got unknown message ${message}`
  }
}

/**
 * @template Layout
 * @param {API.BlockWriter} writer
 * @param {UnixFS.Metadata} metadata
 * @param {API.EncoderSettings} config
 * @returns {State<Layout>}
 */
export const init = (writer, metadata, config) => {
  return {
    status: "open",
    metadata,
    config,
    writer,
    chunker: Chunker.open({ chunker: config.chunker }),
    layout: config.fileLayout.open(),
    // Note: Writing in large slices e.g. 1GiB at a time creates large queues
    // with around `16353` items. Immutable version ends up copying it every
    // time state of the queue changes, which introduces significant overhead.
    // To avoid this overhead we use mutable implementation which is API
    // compatible but makes in place updates.
    // TODO: We should consider using Persistent bit-partitioned vector tries
    // instead of arrays which would provide immutable interface with neglegable
    // overhead.
    // @see https://github.com/Gozala/vectrie
    nodeQueue: Queue.mutable(),
  }
}
/**
 * @template Layout
 * @param {State<Layout>} state
 * @param {Uint8Array} bytes
 * @returns {Update<Layout>}
 */
export const write = (state, bytes) => {
  if (state.status === "open") {
    // Chunk up provided bytes
    const { chunks, ...chunker } = Chunker.write(state.chunker, bytes)

    // Pass chunks to layout engine to produce nodes
    const { nodes, leaves, layout } = state.config.fileLayout.write(
      state.layout,
      chunks
    )

    const { linked, ...nodeQueue } = Queue.addNodes(nodes, state.nodeQueue)

    // Create leaf encode tasks for all new leaves
    const tasks = [
      ...encodeLeaves(leaves, state.config),
      ...encodeBranches(linked, state.config),
    ]

    return {
      state: {
        ...state,
        chunker,
        layout,
        nodeQueue,
      },
      effect: Task.listen({
        link: Task.effects(tasks),
      }),
    }
  } else {
    return panic("Unable to perform write on closed file")
  }
}

/**
 * @template Layout
 * @param {State<Layout>} state
 * @param {API.EncodedFile} entry
 * @returns {Update<Layout>}
 */
export const link = (state, { id, link, block }) => {
  let { linked, ...nodeQueue } = Queue.addLink(id, link, state.nodeQueue)

  const tasks = encodeBranches(linked, state.config)

  /** @type {State<Layout>} */
  const newState =
    state.status === "closed" && id === state.rootID
      ? {
          ...state,
          status: "linked",
          link,
          nodeQueue,
        }
      : { ...state, nodeQueue }

  // If we just linked a root and there is a **suspended** "end" task we create
  // a task to resume it.
  const end =
    state.status === "closed" && id === state.rootID && state.end
      ? state.end.resume()
      : Task.none()

  return {
    state: newState,
    effect: Task.listen({
      link: Task.effects(tasks),
      block: writeBlock(state.writer, block),
      end,
    }),
  }
}

/**
 * @template Layout
 * @param {State<Layout>} state
 * @returns {Update<Layout>}
 */
export const close = state => {
  if (state.status === "open") {
    const { chunks } = Chunker.close(state.chunker)
    const { layout, ...write } = state.config.fileLayout.write(
      state.layout,
      chunks
    )

    const { root, ...close } = state.config.fileLayout.close(
      layout,
      state.metadata
    )

    const [nodes, leaves] = isLeafNode(root)
      ? [
          [...write.nodes, ...close.nodes],
          [...write.leaves, ...close.leaves, root],
        ]
      : [
          [...write.nodes, ...close.nodes, root],
          [...write.leaves, ...close.leaves],
        ]

    const { linked, ...nodeQueue } = Queue.addNodes(nodes, state.nodeQueue)

    const tasks = [
      ...encodeLeaves(leaves, state.config),
      ...encodeBranches(linked, state.config),
    ]

    // We want to keep run loop around until root node is linked. To
    // accomplish this we fork a task that suspends itself, which we will
    // resume when root is linked (see link function).
    // Below we join this forked task in our effect, this way effect is not
    // complete until task forked task is, which will do once we link the
    // root.
    const fork = Task.fork(Task.suspend())

    return {
      state: {
        ...state,
        chunker: null,
        layout: null,
        rootID: root.id,
        status: "closed",
        end: fork,
        nodeQueue,
      },
      effect: Task.listen({
        link: Task.effects(tasks),
        end: Task.join(fork),
      }),
    }
  } else {
    return { state, effect: Task.none() }
  }
}

/**
 * Creates concurrent leaf encode tasks. Each one will have an ID corresponding
 * to index in the queue.
 *
 * @param {Layout.Leaf[]} leaves
 * @param {API.EncoderSettings} config
 */
const encodeLeaves = (leaves, config) =>
  leaves.map(leaf => encodeLeaf(config, leaf, config.fileChunkEncoder))

/**
 * @param {API.EncoderSettings} config
 * @param {Layout.Leaf} leaf
 * @param {API.FileChunkEncoder} encoder
 * @returns {Task.Task<API.EncodedFile, never>}
 */
const encodeLeaf = function* ({ hasher, linker }, { id, content }, encoder) {
  const bytes = encoder.encode(content ? asUint8Array(content) : EMPTY_BUFFER)
  const hash = yield* Task.wait(hasher.digest(bytes))
  const cid = linker.createLink(encoder.code, hash)

  const block = { cid, bytes }
  const link = /** @type {UnixFS.FileLink} */ ({
    cid,
    contentByteLength: content ? content.byteLength : 0,
    dagByteLength: bytes.byteLength,
  })

  return { id, block, link }
}

/**
 * @param {Queue.LinkedNode[]} nodes
 * @param {API.EncoderSettings} config
 */
const encodeBranches = (nodes, config) =>
  nodes.map(node => encodeBranch(config, node))

/**
 * @template Layout
 * @param {API.EncoderSettings<Layout>} config
 * @param {Queue.LinkedNode} node
 * @param {UnixFS.Metadata} [metadata]
 * @returns {Task.Task<API.EncodedFile>}
 */
export const encodeBranch = function* (config, { id, links }, metadata) {
  const bytes = config.fileEncoder.encode({
    type: UnixFS.NodeType.File,
    layout: "advanced",
    parts: links,
    metadata,
  })
  const hash = yield* Task.wait(Promise.resolve(config.hasher.digest(bytes)))
  const cid = config.linker.createLink(config.fileEncoder.code, hash)
  const block = { bytes, cid }
  const link = /** @type {UnixFS.FileLink} */ ({
    cid,
    contentByteLength: UnixFS.cumulativeContentByteLength(links),
    dagByteLength: UnixFS.cumulativeDagByteLength(bytes, links),
  })

  return { id, block, link }
}

/**
 * @param {API.BlockWriter} writer
 * @param {UnixFS.Block} block
 * @returns {Task.Task<void, never>}
 */

export const writeBlock = function* (writer, block) {
  if ((writer.desiredSize || 0) <= 0) {
    yield* Task.wait(writer.ready)
  }
  writer.write(block)
}

/**
 *
 * @param {Uint8Array|Chunker.Chunk} buffer
 * @returns
 */

const asUint8Array = buffer =>
  buffer instanceof Uint8Array
    ? buffer
    : buffer.copyTo(new Uint8Array(buffer.byteLength), 0)

/**
 * @param {Layout.Node} node
 * @returns {node is Layout.Leaf}
 */
const isLeafNode = node => node.children == null
