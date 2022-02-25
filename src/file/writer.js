import * as Task from "actor"
import * as API from "./api.js"
import * as Layout from "./layout/api.js"
import * as UnixFS from "../lib.js"
import * as Channel from "../writer/channel.js"
import * as Chunker from "./chunker.js"
import { panic, unreachable } from "../writer/util.js"
import * as Queue from "./layout/queue.js"

/**
 * @template Layout
 * @typedef {{
 * readonly status: 'open'
 * readonly metadata: UnixFS.Metadata
 * readonly config: API.FileWriterConfig<unknown, Layout>
 * readonly blockQueue: API.BlockQueue
 * chunker: Chunker.State
 * layout: Layout
 * nodeQueue: Queue.Queue
 * }} Open
 */
/**
 * @template Layout
 * @typedef {{
 * readonly status: 'closed'
 * readonly metadata: UnixFS.Metadata
 * readonly config: API.FileWriterConfig<unknown, Layout>
 * readonly blockQueue: API.BlockQueue
 * readonly rootID: Layout.NodeID
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
 * readonly config: API.FileWriterConfig<unknown, Layout>
 * readonly blockQueue: API.BlockQueue
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
    case "block":
      return { state, effect: Task.none() }
    case "close":
      return close(state)
    default:
      return unreachable`File Writer got unknown message ${message}`
  }
}

/**
 * @template Layout
 * @param {UnixFS.Metadata} metadata
 * @param {Channel.Queue<UnixFS.Block>} blockQueue
 * @param {API.FileWriterConfig} config
 * @returns {State<Layout>}
 */
export const init = (metadata, blockQueue, config) => {
  return {
    status: "open",
    metadata,
    config,
    blockQueue,
    chunker: Chunker.open({ chunker: config.chunker }),
    layout: config.fileLayout.open(config.fileLayout.options),
    nodeQueue: Queue.empty(),
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
    const chunker = Chunker.append(state.chunker, bytes)
    const chunks = Chunker.chunks(chunker)
    // Pass chunks to layout engine to produce nodes
    const { nodes, leaves, layout } = state.config.fileLayout.write(
      state.layout,
      chunks
    )
    const { linked, ...nodeQueue } = Queue.addNodes(nodes, state.nodeQueue)

    // Create leaf encode tasks for all new leaves
    const tasks = [
      ...encodeLeaves(leaves, state.config),
      ...encodeNodes(linked, state.config),
    ]

    return {
      state: {
        ...state,
        chunker: Chunker.state(chunker),
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

  const tasks = encodeNodes(linked, state.config)
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

  return {
    state: newState,
    effect: Task.listen({
      link: Task.effects(tasks),
      block: writeBlock(state.blockQueue, block),
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
    const result = Chunker.close(state.chunker)
    if (result.single) {
      const root = { id: 0, content: result.chunk }
      const task = encodeLeaf(state.config, root, state.config.smallFileEncoder)

      return {
        state: {
          ...state,
          chunker: null,
          layout: null,
          rootID: root.id,
          status: "closed",
        },
        effect: Task.listen({ link: Task.effect(task) }),
      }
    } else {
      const { chunks } = result
      const { leaves, nodes, layout } = state.config.fileLayout.write(
        state.layout,
        chunks
      )
      const { root, nodes: rest } = state.config.fileLayout.close(
        layout,
        state.metadata
      )
      const { linked, ...nodeQueue } = Queue.addNodes(
        [...nodes, ...rest, root],
        state.nodeQueue
      )

      const tasks = [
        ...encodeLeaves(leaves, state.config),
        ...encodeNodes(linked, state.config),
      ]

      return {
        state: {
          ...state,
          chunker: null,
          layout: null,
          rootID: root.id,
          status: "closed",
          nodeQueue,
        },
        effect: Task.listen({ link: Task.effects(tasks) }),
      }
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
 * @param {API.FileWriterConfig} config
 */
const encodeLeaves = (leaves, config) =>
  leaves.map(leaf => encodeLeaf(config, leaf, config.fileChunkEncoder))

/**
 * @param {API.FileWriterConfig} config
 * @param {Layout.Leaf} leaf
 * @param {API.FileChunkEncoder} encoder
 * @returns {Task.Task<API.EncodedFile, never>}
 */
const encodeLeaf = function* ({ hasher, createCID }, { id, content }, encoder) {
  const bytes = encoder.encode(content)
  const hash = yield* Task.wait(hasher.digest(bytes))
  const cid = createCID(encoder.code, hash)

  const block = { cid, bytes }
  const link = {
    cid,
    contentByteLength: content.byteLength,
    dagByteLength: bytes.byteLength,
  }

  return { id, block, link }
}

/**
 * @param {Queue.LinkedNode[]} nodes
 * @param {API.FileWriterConfig} config
 */
const encodeNodes = (nodes, config) =>
  nodes.map(node => encodeNode(config, node))

/**
 * @template Layout
 * @param {API.FileWriterConfig<unknown, Layout>} config
 * @param {Queue.LinkedNode} node
 * @param {UnixFS.Metadata} [metadata]
 * @returns {Task.Task<API.EncodedFile>}
 */
export const encodeNode = function* (config, { id, links }, metadata) {
  const bytes = config.fileEncoder.encode({
    type: UnixFS.NodeType.File,
    layout: "advanced",
    parts: links,
    metadata,
  })
  const hash = yield* Task.wait(config.hasher.digest(bytes))
  const cid = config.createCID(config.fileEncoder.code, hash)
  const block = { bytes, cid }
  const link = {
    cid,
    contentByteLength: links.reduce(
      (total, n) => total + n.contentByteLength,
      0
    ),
    dagByteLength: links.reduce(
      (total, n) => total + n.dagByteLength,
      bytes.byteLength
    ),
  }

  return { id, block, link }
}

/**
 * @param {API.BlockQueue} blockQueue
 * @param {UnixFS.Block} block
 * @returns {Task.Task<void, never>}
 */

export const writeBlock = function* (blockQueue, block) {
  if (blockQueue.desiredSize <= 0) {
    yield* Task.wait(blockQueue.ready)
  }
  blockQueue.enqueue(block)
}
