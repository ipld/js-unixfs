import * as Task from "actor"
import * as API from "./api.js"
import * as Layout from "./layout/api.js"
import * as UnixFS from "../unixfs.js"
import { unreachable, defer, EMPTY } from "../writer/util.js"

export * from "./layout/api.js"

/**
 * @template S
 * @typedef {API.FileWriterConfig<unknown, S>} Config
 */

/**
 * @template S
 * @typedef {{
 * config: Config<S>
 * layout: S
 * metadata: UnixFS.Metadata
 * links: Links
 * }} State
 */

/**
 * LayoutNode.id -> Link mapping. Used to store links (or promises for them)
 * so that they can be pulled during node encoding.
 *
 * @typedef {Record<number, API.Defer<UnixFS.FileLink>|UnixFS.FileLink>} Links
 */

/**
 * @typedef {never
 * | { type: "leaf", leaf: UnixFS.FileLink }
 * | { type: "link", link: API.EncodedFile }
 * | { type: "root", root: API.EncodedFile }
 * | { type: "close" }
 * } Message
 */

/**
 * @template S
 * @typedef  {{
 * state: State<S>
 * effect: Task.Effect<Message>
 * }} Update
 */

/**
 * @template S
 * @param {UnixFS.Metadata} metadata
 * @param {Config<S>} config
 * @returns {State<S>}
 */
export const open = (metadata, config) => ({
  config,
  metadata,
  links: {},
  layout: config.fileLayout.open(config.fileLayout.options),
})

/**
 * @template T
 * @param {Update<T>} tr
 */
export const state = tr => tr.state

/**
 * @template T
 * @param {Update<T>} tr
 */
export const effect = tr => tr.effect

/**
 * @template S
 * @param {State<S>} state
 * @param {Message} message
 * @returns {Update<S>}
 */

export const update = (state, message) => {
  switch (message.type) {
    case "link":
      return updateLink(state, message.link)
    case "leaf":
      return addLeaf(state, message.leaf)
    case "close":
      return close(state)
    default: {
      return unreachable`Layout received unknown message ${message}`
    }
  }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {UnixFS.FileLink} leaf
 * @returns {Update<S>}
 */
export const addLeaf = (state, leaf) => {
  const { config } = state
  const links = { ...state.links }

  // First we pass the leaf node to the file layout component, which updates
  // own state and give us back new layout nodes if it created some.
  const { state: layout, nodes } = config.fileLayout.write(state.layout, [leaf])
  // If there are new layout nodes link them otherwise just update the layout
  // state.
  return nodes.length > 0
    ? linkNodes({ ...state, layout }, nodes)
    : { state: { ...state, layout }, effect: Task.none() }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {UnixFS.FileLink[]} leaves
 * @returns {Update<S>}
 */
export const addLeaves = (state, leaves) => {
  // First we pass the leaf node to the file layout component, which updates
  // own state and give us back new layout nodes if it created some.
  const { state: layout, nodes } =
    leaves.length > 0
      ? state.config.fileLayout.write(state.layout, leaves)
      : { state: state.layout, nodes: EMPTY }

  // If there are new layout nodes link them otherwise just update the layout
  // state.
  return nodes.length > 0
    ? linkNodes({ ...state, layout }, nodes)
    : { state: { ...state, layout }, effect: Task.none() }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {UnixFS.FileLink} leaf
 */
export const appendLeaf = (state, leaf) => {
  const { config } = state
  const links = { ...state.links }

  // First we pass the leaf node to the file layout component, which updates
  // own state and give us back new layout nodes if it created some.
  const { state: layout, nodes } = config.fileLayout.write(state.layout, [leaf])
  // If there are new layout nodes link them otherwise just update the layout
  // state.
  return wrapNodes({ ...state, layout }, nodes)
}

/**
 * @template S
 * @param {State<S>} state
 * @param {Layout.Node[]} nodes
 * @param {UnixFS.Metadata} [metadata]
 * @returns {{state:State<S>, tasks:Task.Task<API.EncodedFile, Error>[]}}
 */
const wrapNodes = (state, nodes, metadata) => {
  const { config } = state
  const links = { ...state.links }
  // Go over each layout node and store a promise which we'll resolve
  // with a link once node is encoded and `link` message is received.
  // We also create encode task for ecah node which we'll turn into an effect.
  const tasks = []
  for (const node of nodes) {
    links[node.id] = defer()
    // dereference links either directly from the node or from the links
    // map where we'll either have deferred or a ready link.
    const children = node.children.map(child =>
      typeof child === "number" ? unlink(links, child) : child
    )
    tasks.push(encodeNode(config, node.id, children, metadata))
  }

  return { state: { ...state, links }, tasks }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {Layout.Node[]} nodes
 * @param {UnixFS.Metadata} [metadata]
 * @returns {Update<S>}
 */
const linkNodes = (state, nodes, metadata) => {
  const { config } = state
  const links = { ...state.links }
  // Go over each layout node and store a promise which we'll resolve
  // with a link once node is encoded and `link` message is received.
  // We also create encode task for ecah node which we'll turn into an effect.
  const tasks = []
  for (const node of nodes) {
    links[node.id] = defer()
    // dereference links either directly from the node or from the links
    // map where we'll either have deferred or a ready link.
    const children = node.children.map(child =>
      typeof child === "number" ? unlink(links, child) : child
    )
    tasks.push(encodeNode(config, node.id, children, metadata))
  }

  // Turn encode tasks into an effect that will run each concurrently and
  // prdouce link messages for each as soon as they're ready.
  const effect = Task.listen({ link: Task.effects(tasks) })

  return { state: { ...state, links }, effect }
}

/**
 * @param {Config<unknown>} config
 * @param {number} id
 * @param {(UnixFS.FileLink|API.Defer<UnixFS.FileLink>)[]} links
 * @param {UnixFS.Metadata} [metadata]
 * @returns {Task.Task<API.EncodedFile>}
 */
export const encodeNode = function* (config, id, links, metadata) {
  const parts = []
  for (const link of links) {
    const part = yield* Task.wait(link)
    parts.push(part)
  }

  const bytes = config.fileEncoder.encode({
    type: UnixFS.NodeType.File,
    layout: "advanced",
    parts,
    metadata,
  })
  const hash = yield* Task.wait(config.hasher.digest(bytes))
  const cid = config.createCID(config.fileEncoder.code, hash)
  const block = { bytes, cid }
  const link = {
    cid,
    contentByteLength: parts.reduce(
      (total, n) => total + n.contentByteLength,
      0
    ),
    dagByteLength: parts.reduce(
      (total, n) => total + n.dagByteLength,
      bytes.byteLength
    ),
  }

  return { id, block, link }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {API.EncodedFile} node
 * @returns {Update<S>}
 */
export const updateLink = (state, node) => {
  const { config } = state

  // Swap the link with an actual node so that parent can avoid await.
  const links = link(state.links, node.id, node.link)

  return {
    state: { ...state, links },
    effect: Task.none(), //enqueue(service, node.block)
  }
}

/**
 * @template S
 * @param {State<S>} state
 * @param {number} id
 * @param {UnixFS.FileLink} target
 * @returns {State<S>}
 */
export const linkNode = (state, id, target) => {
  // Swap the link with an actual node so that parent can avoid await.
  const links = link(state.links, id, target)

  return { ...state, links }
}

/**
 * @param {API.BlockQueue} blockQueue
 * @param {UnixFS.Block} block
 * @returns {Task.Task<void, never>}
 */

export const enqueue = function* (blockQueue, block) {
  if (blockQueue.desiredSize <= 0) {
    yield* Task.wait(blockQueue.ready)
  }
  blockQueue.enqueue(block)
}

/**
 * @template S
 * @param {State<S>} state
 * @returns {Update<S>}
 */
export const close = state => {
  const { config, layout, metadata } = state
  const { root, nodes } = config.fileLayout.close(layout)
  const updateNodes = linkNodes(state, nodes)
  const updateRoot = linkNodes(updateNodes.state, [root], metadata)

  const effect = function* () {
    // Wait for all the links to finish first
    yield* updateNodes.effect
    yield* updateRoot.effect
  }

  return { state: updateRoot.state, effect: effect() }
}

/**
 * @template S
 * @param {State<S>} state
 */
export const close2 = state => {
  const { config, layout, metadata } = state
  const { root, nodes } = config.fileLayout.close(layout)

  const updateNodes = wrapNodes(state, nodes)
  const updateRoot = wrapNodes(updateNodes.state, [root], metadata)

  return {
    state: updateRoot.state,
    tasks: { nodes: updateNodes.tasks, root: updateRoot.tasks[0] },
  }
}

// /**
//  * @template S
//  * @param {State<S>} self
//  * @param {API.FileDAG.Link[]} leaves
//  */

// export const write = (self, leaves) => {
//   const { service, links, layout } = self
//   const result = service.fileLayout.write(layout, leaves)
//   for (const node of result.nodes) {
//     links.set(node.id, Task.promise(link(self, node)))
//   }

//   return { ...self, links, layout: result.state }
// }

// /**
//  * @template S
//  * @param {State<S>} self
//  */
// export const end = function * (self) {
//   const { service, links, layout, metadata } = self
//   const result = service.fileLayout.close(layout)
//   for (const node of result.nodes) {
//     links.set(node.id, Task.promise(link(self, node)))
//   }

//   const root = yield * link(self, result.root, metadata)
//   // Otherwise it will complain about remaining nodes
//   self.links.delete(result.root.id)

//   // Invariant check, to ensure that all the links have been consumed prior to closing
//   if (links.size > 0) {
//     throw new RangeError(`All nodes should have been linked prior to closing a file, still get ${[...links.keys()]}`)
//   }

//   return root
//   // }

//   // return Task.perform(close)
// }

// /**
//  * @template S
//  * @param {State<S>} self
//  */
// export const close = (self) => Task.promise(end(self))

// /**
//  * Takes FileChunk / FileShard node and takes care of turning into a UnixFS
//  * block and associating it with given node id. That is accomplished through
//  * the following steps.
//  *
//  * 1. Encodes it into UinxFS block.
//  * 2. Pushes block into a blockQueue.
//  * 3. Removes links this node references (Please note node should only be
//  * referenced once, so they get dropped to release some memory).
//  * 4. Stores link in links map (So it could be pulled when another node
//  * will reference it).
//  * 5. Return the link (or it's promise back)
//  *
//  * @template S
//  * @param {State<S>} self
//  * @param {API.FileDAG.LayoutNode} node
//  * @param {API.Metadata} [metadata]
//  */
// const link = function * (self, node, metadata) {
//   const parts = yield * collectParts(self, node.children)

//   const block = self.service.fileEncoder.encode({
//     type: 2,
//     layout: 'advanced',
//     parts,
//     metadata
//   })

//   const hash = yield * Task.wait(self.service.hasher.digest(block))
//   const cid = self.service.createCID(self.service.fileEncoder.code, hash)
//   const link = {
//     cid,
//     contentByteLength: parts.reduce((total, n) => total + n.contentByteLength, 0),
//     dagByteLength: parts.reduce((total, n) => total + n.dagByteLength, block.byteLength)
//   }
//   self.links.set(node.id, link)

//   self.service.blockQueue.enqueue({ bytes: block, cid })
//   return link
// }

// /**
//  * @param {State<unknown>} self
//  * @param {API.FileDAG.ChildNode[]} children
//  */
// const collectParts = function * (self, children) {
//   // /** @type {API.Await<API.FileDAG.Link>[]} */
//   /** @type {API.FileDAG.Link[]} */
//   const parts = []
//   // let requiresAwait = false
//   for (const child of children) {
//     if (typeof child === 'number') {
//       const link = unlink(self, child)
//       parts.push(yield * Task.wait(link))
//       // requiresAwait = requiresAwait || isPromise(link)
//     } else {
//       parts.push(child)
//     }
//   }
//   // return requiresAwait ? Promise.all(parts) : /** @type {API.FileDAG.Link[]} */(parts)
//   return parts
// }

/**
 * Gets the DAG link for the given node identifier & removes it from the map.
 * It will throw an error if link is not found, although it should never be
 * the case unless there is some logic error.
 *
 * @param {Links} links
 * @param {number} id
 */
export const unlink = (links, id) => {
  const link = links[id]
  if (!link) {
    throw Error(`Node with ${id} was not found`)
  } else {
    delete links[id]
    return link
  }
}

/**
 * @param {Links} links
 * @param {number} id
 * @param {UnixFS.FileLink} link
 */

export const link = (links, id, link) => {
  const value = links[id]
  if (value != null) {
    const pending = /** @type {API.Defer<UnixFS.FileLink>} */ (value)
    delete links[id]
    pending.succeed(link)
    return links
  } else {
    links[id] = link
    return links
  }
}
