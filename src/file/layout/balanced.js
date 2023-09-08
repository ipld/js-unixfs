import * as Layout from "./api.js"
import * as Chunker from "./../chunker/api.js"

/**
 * Type representing a state of the balanced tree. First row hold leaves coming
 * into a builder, once number of leaves in the stack reaches `maxChildren` they
 * are moved into `RootNode` instance which is pushed into the next row of nodes.
 * If next row now contains `maxChildren` nodes from there are again moved into
 * a new `RootNode` and pushed into next row etc...
 *
 * For illustration let's assume we have `maxChildren: 3`, after 3 leafs were
 * added tree will have following layout
 *
 * ```
 *           (root1)
 *              |
 *    ----------------------
 *    |         |          |
 * (leaf1)   (leaf2)    (leaf3)
 * ```
 *
 * Which in our model before flushing is represented as follows:
 *
 * ```js
 * {
 *    width: 3
 *    leafIndex: [leaf1, leaf2, leaf3]
 *    nodeIndex: []
 *    nodes: []
 * }
 * ```
 *
 * After flushing 3 leaves (which is width) are moved into a `RootNode` that
 * is added to `nodes` array (and returned so that caller can create a block).
 * Additionally position of the added node is captured in the `index` at an
 * appropriate depth `0` (that is because we don't count leaves into depth).
 *
 * ```js
 * {
 *    width: 3
 *    leafIndex: []
 *    nodeIndex: [[0]]
 *    nodes: [new RootNode([leaf1, leaf2, leaf3])]
 * }
 * ```
 *
 * Increasing number of leaves to 10 would produce following tree layout
 *
 *```
 *                                                         (root7)
 *                                                           |
 *                                    ------------------------------------------
 *                                    |                                        |
 *                                 (root4)                                  (root6)
 *                                    |                                        |
 *            -------------------------------------------------                |
 *            |                       |                       |                |
 *         (root1)                 (root2)                 (root3)          (root5)
 *            |                       |                       |                |
 *    --------|--------       --------|--------       --------|--------        |
 *    |       |       |       |       |       |       |       |       |        |
 * (leaf1) (leaf2) (leaf3) (leaf4) (leaf5) (leaf6) (leaf7) (leaf8) (leaf9) (leaf10)
 * ```
 *
 * Which in our model will look as follows (note we do not have root5 - root7
 * in model because they are build once width is reached or once builder is
 * closed)
 *
 * ```js
 * {
 *    width: 3
 *    leafIndex: [leaf10]
 *    nodeIndex: [
 *      [0, 1, 2], // [r1, r2, r3]
 *      [3]        // [r4]
 *     ]
 *    nodes: [
 *      new Node([leaf1, leaf2, leaf3]), // r1
 *      new Node([leaf4, leaf5, leaf6]), // r2
 *      new Node([leaf7, leaf8, leaf9]), // r3
 *      new Node([ // r4
 *         new Node([leaf1, leaf2, leaf3]), // r1
 *         new Node([leaf4, leaf5, leaf6]), // r2
 *         new Node([leaf7, leaf8, leaf9]), // r3
 *      ])
 *    ]
 * }
 * ```
 *
 * @typedef {{
 * width: number
 * head: Chunker.Chunk | null
 * leafIndex: number[]
 * nodeIndex: number[][]
 * lastID: number
 * }} Balanced
 */

class Node {
  /**
   *
   * @param {number} id
   * @param {number[]} children
   * @param {Layout.Metadata} [metadata]
   */
  constructor(id, children, metadata) {
    this.id = id
    this.children = children
    this.metadata = metadata
  }
}

/**
 * @typedef Options
 * @property {number} width - Max children per node.
 *
 * @param {number} width
 * @returns {Layout.LayoutEngine<Balanced>}
 */
export const withWidth = width => ({
  open: () => open({ width }),
  write,
  close,
})

export const defaults = { width: 174 }

/**
 * @param {Options} options
 * @returns {Balanced}
 */
export const open = ({ width } = defaults) => ({
  width,

  head: null,
  leafIndex: [],
  nodeIndex: [],
  lastID: 0,
})

/**
 *
 * @param {Balanced} layout
 * @param {Chunker.Chunk[]} chunks
 * @returns {Layout.WriteResult<Balanced>}
 */
export const write = (layout, chunks) => {
  if (chunks.length === 0) {
    return { layout, nodes: EMPTY, leaves: EMPTY }
  } else {
    let { lastID } = layout
    // We need to hold on to the first chunk until we either get a second chunk
    // (at which point we know our layout will have branches) or until we close
    // (at which point our layout will be single leaf or node depneding on
    // metadata)
    const [head, slices] = layout.head
      ? // If we had a head we have more then two chunks (we already checked
        // chunks weren't empty) so we process head along with other chunks.
        [null, (chunks.unshift(layout.head), chunks)]
      : // If we have no head no leaves and got only one chunk we have to save it
      // until we can decide what to do with it.
      chunks.length === 1 && layout.leafIndex.length === 0
      ? [chunks[0], EMPTY]
      : // Otherwise we have no head but got enough chunks to know we'll have a
        // node.
        [null, chunks]

    if (slices.length === 0) {
      return { layout: { ...layout, head }, nodes: EMPTY, leaves: EMPTY }
    } else {
      const leafIndex = [...layout.leafIndex]
      const leaves = []
      for (const chunk of slices) {
        const leaf = { id: ++lastID, content: chunk }
        leaves.push(leaf)
        leafIndex.push(leaf.id)
      }

      if (leafIndex.length > layout.width) {
        return flush({ ...layout, leafIndex, head, lastID }, leaves)
      } else {
        return {
          layout: { ...layout, head, leafIndex, lastID },
          leaves,
          nodes: EMPTY,
        }
      }
    }
  }
}

/**
 * @param {Balanced} state
 * @param {Layout.Leaf[]} leaves
 * @param {Layout.Branch[]} [nodes]
 * @param {boolean} [close]
 * @returns {Layout.WriteResult<Balanced>}
 */
export const flush = (state, leaves = EMPTY, nodes = [], close = false) => {
  let { lastID } = state
  const nodeIndex = state.nodeIndex.map(row => [...row])
  const leafIndex = [...state.leafIndex]
  const { width } = state

  // Move leaves into nodes
  while (leafIndex.length > width || (leafIndex.length > 0 && close)) {
    grow(nodeIndex, 1)
    const node = new Node(++lastID, leafIndex.splice(0, width))
    nodeIndex[0].push(node.id)
    nodes.push(node)
  }

  let depth = 0
  while (depth < nodeIndex.length) {
    const row = nodeIndex[depth]
    depth++

    while (
      row.length > width ||
      (row.length > 0 && close && depth < nodeIndex.length)
    ) {
      const node = new Node(++lastID, row.splice(0, width))
      grow(nodeIndex, depth + 1)
      nodeIndex[depth].push(node.id)
      nodes.push(node)
    }
  }

  return { layout: { ...state, lastID, leafIndex, nodeIndex }, leaves, nodes }
}

/**
 * @param {Balanced} layout
 * @param {Layout.Metadata} [metadata]
 * @returns {Layout.CloseResult}
 */
export const close = (layout, metadata) => {
  const state = layout
  if (layout.head) {
    return {
      root: { id: 1, content: layout.head, metadata },
      leaves: EMPTY,
      nodes: EMPTY,
    }
  } else if (layout.leafIndex.length === 0) {
    return {
      root: { id: 1, metadata },
      leaves: EMPTY,
      nodes: EMPTY,
    }
  } else {
    // Flush with width 1 so all the items will be propagate up the tree
    // and height of `depth-1` so we propagate nodes all but from the top
    // most level
    const { nodes, layout } = flush(state, EMPTY, [], true)

    const { nodeIndex } = layout
    const height = nodeIndex.length - 1

    const top = nodeIndex[height]
    if (top.length === 1) {
      const root = nodes[nodes.length - 1]
      nodes.length = nodes.length - 1
      return { root, nodes, leaves: EMPTY }
    } else {
      const root = new Node(layout.lastID + 1, top, metadata)
      return { root, nodes, leaves: EMPTY }
    }
  }
}

/**
 * @template T
 * @param {T[][]} index
 * @param {number} length
 */
const grow = (index, length) => {
  while (index.length < length) {
    index.push([])
  }
  return index
}

/** @type {never[]} */
const EMPTY = []
