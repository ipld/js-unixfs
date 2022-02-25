import * as UnixFS from "../src/lib.js"
import * as Layout from "../src/file/layout/api.js/index.js.js.js"
import * as Task from "actor"

/**
 * @template S
 * @typedef {{
 * layout: Layout.Layout<unknown, S>
 * fileChunkEncoder: Layout.FileChunkEncoder
 * smallFileEncoder: Layout.FileChunkEncoder
 * fileEncoder: Layout.FileEncoder
 * hasher: Layout.MultihashHasher<number>
 * cidCreator: Layout.CreateCID
 * }} Service
 */

/**
 * @template S
 * @typedef {{
 * service: Service<S>
 * layout: S
 * metadata: UnixFS.Metadata
 * links: Map<number, Layout.Link>
 * }} State
 */

/**
 * @template S
 * @param {UnixFS.Metadata} metadata
 * @param {Service<S>} service
 * @returns {State<S>}
 */
export const open = (metadata, service) => ({
  service,
  metadata,
  links: new Map(),
  layout: service.layout.open(service.layout.options),
})

/**
 * @template S
 * @param {State<S>} self
 * @param {Layout.Link[]} leaves
 */

export function* write(self, leaves) {
  const { service, links, layout } = self
  const result = service.layout.write(layout, leaves)
  for (const node of result.nodes) {
    links.set(node.id, yield* link(self, node))
  }

  return { ...self, layout: result.state }
}

/**
 *@template S
 * @param {State<S>} self
 * @returns
 */
export function* close(self) {
  // function * close () {aoeauaoeuauoaoeua
  const { service, links, layout, metadata } = self
  const result = service.layout.close(layout)
  for (const node of result.nodes) {
    links.set(node.id, yield* link(self, node))
  }

  const root = yield* link(self, result.root, metadata)

  // Invariant check, to ensure that all the links have been consumed prior to closing
  if (links.size > 0) {
    throw new RangeError(
      `All nodes should have been linked prior to closing a file, still get ${links.keys()}`
    )
  }

  return root
}

/**
 * Takes FileChunk / FileShard node and takes care of turning into a UnixFS
 * block and associating it with given node id. That is accomplished through
 * the following steps.
 *
 * 1. Encodes it into UinxFS block.
 * 2. Pushes block into a blockQueue.
 * 3. Removes links this node references (Please note node should only be
 * referenced once, so they get dropped to release some memory).
 * 4. Stores link in links map (So it could be pulled when another node
 * will reference it).
 * 5. Return the link (or it's promise back)
 *
 * @template S
 * @param {State<S>} self
 * @param {Layout.Node} node
 * @param {UnixFS.Metadata} [metadata]
 * @returns {Task.Task<UnixFS.FileLink, never>}
 */
function* link(self, node, metadata) {
  const parts = yield* collectParts(self, node.children)

  const block = self.service.fileEncoder.encode({
    type: 2,
    layout: "advanced",
    parts,
    metadata,
  })

  // oueuoaa
  const hash = yield* Task.wait(self.service.hasher.digest(block))
  const cid = self.service.cidCreator(self.service.fileEncoder.code, hash)
  const link = {
    cid,
    contentByteLength: parts.reduce(
      (total, n) => total + n.contentByteLength,
      0
    ),
    dagByteLength: parts.reduce(
      (total, n) => total + n.dagByteLength,
      block.byteLength
    ),
  }
  self.links.set(node.id, link)

  // self.service.blockQueue.enqueue({ bytes: block, cid })
  return link
}

/**
 * @param {State<unknown>} self
 * @param {Layout.ChildNode[]} children
 * @returns {Task.Task<Layout.Link[], never>}
 */
const collectParts = function* (self, children) {
  // /** @type {API.Await<API.FileDAG.Link>[]} */
  /** @type {Layout.Link[]} */
  const parts = []
  // let requiresAwait = false
  for (const child of children) {
    if (typeof child === "number") {
      const link = unlink(self, child)
      parts.push(yield* Task.wait(link))
      // requiresAwait = requiresAwait || isPromise(link)
    } else {
      parts.push(child)
    }
  }
  // return requiresAwait ? Promise.all(parts) : /** @type {API.FileDAG.Link[]} */(parts)
  return parts
}

/**
 * Gets the DAG link for the given node identifier & removes it from the map.
 * It will throw an error if link is not found, although it should never be
 * the case unless there is some logic error.
 *
 * @template S
 * @param {State<S>} self
 * @param {number} id
 */
const unlink = (self, id) => {
  const link = self.links.get(id)
  if (!link) {
    throw Error(`Node with ${id} was not found`)
  } else {
    self.links.delete(id)
    return link
  }
}
