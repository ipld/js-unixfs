import * as Layout from "./api.js"
import * as Queue from "./queue/api.js"
export * from "./queue/api.js"

/**
 * @returns {Queue.Result}
 */
export const empty = () => ({
  mutable: false,
  needs: {},
  nodes: {},
  links: {},
  linked: [],
})

export const mutable = () => ({
  mutable: true,
  needs: {},
  nodes: {},
  links: {},
  linked: EMPTY,
})

/**
 * Adds given layout node to the layout queue. If links for all of the node
 * children are available correspnoding linked node is added (removing links
 * form the queue) otherwise `nood` is added to the wait queue until all the
 * needed links are added.
 *
 *
 * @param {Layout.Branch} node
 * @param {Queue.Queue} queue
 * @returns {Queue.Result}
 */
export const addNode = (node, queue) => addNodes([node], queue)

/**
 *
 * @param {Layout.Branch[]} newNodes
 * @param {Queue.Queue} input
 * @returns {Queue.Result}
 */
export const addNodes = (newNodes, input) => {
  let queue = patch(input, {})
  for (const node of newNodes) {
    const { ready, has, wants } = collect(node.children, queue.links)
    // If node isn't waiting on any of the children it's ready to be linked
    // so we add linked node diretly.
    if (wants.length === 0) {
      queue = patch(queue, {
        links: assign(undefined, has),
        linked: [{ id: node.id, links: ready }],
      })
    } else {
      queue = patch(queue, {
        needs: assign(node.id, wants),
        nodes: {
          [node.id]: {
            children: node.children,
            count: wants.length,
          },
        },
      })
    }
  }

  return queue
}

/**
 * Adds link to the queue. If queue contains a node that needs this link it gets
 * updated. Either it's gets linked (when it was blocked only on this link) or
 * it's want could is reduced. If no node needed this link it just gets stored
 * for the future node that will need it.
 *
 *
 * @param {Queue.NodeID} id
 * @param {Queue.Link} link
 * @param {Queue.Queue} queue
 * @returns {Queue.Result}
 */

export const addLink = (id, link, queue) => {
  const nodeID = queue.needs[id]
  const node = queue.nodes[nodeID]
  // We have node than needs this link.
  if (node != null) {
    // This is the only link it needed so we materialize the node and remove
    // links and needs associated with it.
    if (node.count === 1) {
      const { ready, has } = collect(node.children, {
        ...queue.links,
        [id]: link,
      })

      return patch(queue, {
        needs: { [id]: undefined },
        links: assign(undefined, has),
        nodes: { [nodeID]: undefined },
        linked: [{ id: nodeID, links: ready }],
      })
    }
    // If node needs more links we just reduce a want count and remove this
    // need.
    else {
      return patch(queue, {
        needs: { [id]: undefined },
        links: { [id]: link },
        nodes: {
          [nodeID]: {
            ...node,
            count: node.count - 1,
          },
        },
      })
    }
  }
  // If we have no one waiting for this link just add it to the queue
  else {
    return patch(queue, {
      links: { [id]: link },
    })
  }
}

/**
 *
 * @param {Queue.Queue} queue
 * @param {Queue.Delta} delta
 */

const patch = (queue, { needs, nodes, links, linked }) => {
  const result = queue.mutable ? queue : { ...queue }
  const original = queue.mutable ? BLANK : undefined

  if (needs) {
    result.needs = patchDict(queue.needs, needs, original)
  }

  if (nodes) {
    result.nodes = patchDict(queue.nodes, nodes, original)
  }

  if (links) {
    result.links = patchDict(queue.links, links, original)
  }

  result.linked = linked
    ? append(queue.linked || EMPTY, linked, EMPTY)
    : queue.linked || []

  return /** @type {Queue.Result} */ (result)
}

/**
 * @template V
 * @template {PropertyKey} K
 * @param {V} value
 * @param {K[]} keys
 * @returns {Record<K, V>}
 */

const assign = (value, keys) => {
  const delta = /** @type {Record<K, V>} */ ({})
  for (const key of keys) {
    delta[key] = value
  }

  return delta
}

/**
 * @template {PropertyKey} K
 * @template V
 * @param {Record<K, V>} target
 *
 * @param {Record<K, V|void>} delta
 * @param {Record<K, V>} original
 * @returns {Record<K, V>}
 */

const patchDict = (target, delta, original = target) => {
  const result = target === original ? { ...target } : target
  for (const entry of Object.entries(delta)) {
    const [id, value] = /** @type {[K, V|void]} */ (entry)
    if (value == null) {
      delete result[id]
    } else {
      result[id] = value
    }
  }

  return result
}
/**
 *
 * @param {Iterable<[Queue.NodeID, Queue.Link]>} entries
 * @param {Queue.Queue} queue
 * @returns {Queue.Queue}
 */
export const addLinks = (entries, queue) => {
  for (const [id, link] of entries) {
    queue = addLink(id, link, queue)
  }
  return queue
}

/**
 * @param {Queue.Queue} queue
 */

export const isEmpty = queue =>
  Object.keys(queue.nodes).length === 0 && Object.keys(queue.links).length === 0

/**
 * @template T
 * @param {T[]} target
 * @param {T[]} items
 * @param {T[]} original
 */
const append = (target, items, original = target) => {
  if (target === original) {
    return [...target, ...items]
  } else {
    for (const item of items) {
      target.push(item)
    }
    return target
  }
}

/**
 * @param {Queue.NodeID[]} children
 * @param {Record<Queue.NodeID, Queue.Link>} source
 * @returns {{has:Queue.NodeID[], wants:Queue.NodeID[], ready:Queue.Link[]}}
 */
const collect = (children, source) => {
  const has = []
  const wants = []
  const ready = []
  for (const child of children) {
    const link = source[child]
    if (link) {
      has.push(child)
      ready.push(link)
    } else {
      wants.push(child)
    }
  }

  return { has, wants, ready }
}

const EMPTY = /** @type {never[]} */ (Object.freeze([]))

const BLANK = /** @type {Record<never, never>} */ (Object.freeze({}))
