import * as UnixFS from "../../unixfs.js"
import * as Layout from "./api.js"
import * as Queue from "./queue/api.js"
export * from "./queue/api.js"
/**
 * @returns {Queue.Result}
 */
export const empty = () => ({
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
 * @param {Queue.Queue} queue
 * @returns {Queue.Result}
 */
export const addNodes = (newNodes, queue) => {
  let { nodes, linked = [], links } = queue
  let needs = queue.needs
  for (const node of newNodes) {
    const { ready, has, wants } = collect(node.children, links)
    // If node isn't waiting on any of the children it's ready to be linked
    // so we add linked node diretly.
    if (wants.length === 0) {
      links = remove(links, has, queue.links)
      linked = push(linked, { id: node.id, links: ready }, queue.linked)
    } else {
      needs = set(needs, wants, node.id)
      nodes = set(nodes, [node.id], {
        children: node.children,
        count: wants.length,
      })
    }
  }

  return { ...queue, nodes, links, linked, needs }
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
  const linked = queue.linked || []
  // We have node than needs this link.
  if (node != null) {
    // This is the only link it needed so we materialize the node and remove
    // links and needs associated with it.
    if (node.count === 1) {
      const { ready, has } = collect(node.children, {
        ...queue.links,
        [id]: link,
      })

      return {
        ...queue,
        needs: remove(queue.needs, [id]),
        linked: [...linked, { id: nodeID, links: ready }],
        links: remove(queue.links, has),
        nodes: remove(queue.nodes, [nodeID]),
      }
    }
    // If node needs more links we just reduce a want count and remove this
    // need.
    else {
      return {
        ...queue,
        needs: remove(queue.needs, [id]),
        links: { ...queue.links, [id]: link },
        linked,
        nodes: {
          ...queue.nodes,
          [nodeID]: {
            ...node,
            count: node.count - 1,
          },
        },
      }
    }
  }
  // If we have no one waiting for this link just add it to the queue
  else {
    return { ...queue, links: { ...queue.links, [id]: link }, linked }
  }
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
 * @template {PropertyKey} K
 * @template V
 * @param {Record<K, V>} from
 * @param {K[]} keys
 * @param {Record<K, V>} original
 */
const remove = (from, keys, original = from) => {
  if (keys.length === 0) {
    return from
  } else {
    const next = from === original ? { ...from } : from
    for (const key of keys) {
      delete next[key]
    }
    return next
  }
}

/**
 * @template {PropertyKey} K
 * @template V
 * @param {Record<K, V>} target
 * @param {K[]} keys
 * @param {V} value
 * @param {Record<K, V>} original
 */
const set = (target, keys, value, original = target) => {
  const object = target === original ? { ...target } : target
  for (const key of keys) {
    object[key] = value
  }
  return object
}

/**
 * @template T
 * @param {T[]} items
 * @param {T} item
 * @param {T[]} original
 */
const push = (items, item, original = items) => {
  if (items === original) {
    return [...items, item]
  } else {
    items.push(item)
    return items
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
