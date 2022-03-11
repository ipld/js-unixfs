import * as Layout from "./api.js"
import * as Chunker from "../chunker/api.js"

export const name = "trickle"

/**
 * @typedef {{
 * maxSiblingSubgroups: number
 * maxDirectLeaves: number
 * unixfsNulLeafCompat: boolean
 * }} Options
 *
 * @type {Options}
 */
export const options = {
  maxSiblingSubgroups: 4,
  maxDirectLeaves: 174,
  unixfsNulLeafCompat: false,
}

/**
 * @param {Partial<Options>} options
 * @returns {Layout.Layout<Options, Trickle>}
 */
export const configure = ({
  maxSiblingSubgroups = 4,
  maxDirectLeaves = 174,
  unixfsNulLeafCompat = false,
}) => ({
  options: {
    maxDirectLeaves,
    maxSiblingSubgroups,
    unixfsNulLeafCompat,
  },
  open,
  write,
  close,
})

// We reserve 0 as an ID for the empty leaf block as there is a special case
// for them.
const EMTPY_LEAF_ID = 0

/**
 * @typedef {{
 * options: Options
 * leafCount: number
 * levelCutoffs: number[]
 * tail: TrickleNode
 * lastID: number
 * }} Trickle
 *
 * @param {Options} options
 * @returns {Trickle}
 */
export const open = options => ({
  options,
  leafCount: 0,
  levelCutoffs: [options.maxDirectLeaves],
  tail: new TrickleNode({
    id: EMTPY_LEAF_ID + 2,
    depth: 0,
    directLeaves: [],
    // this is a synthetic parent to hold the final-most-est digest CID
    parent: new TrickleNode({
      id: EMTPY_LEAF_ID + 1,
      depth: -1,
      directLeaves: [],
      parent: null,
    }),
  }),
  lastID: EMTPY_LEAF_ID,
})

/**
 * @param {Trickle} state
 * @param {Chunker.Buffer[]} leaves
 * @returns {Layout.WriteResult<Trickle>}
 */
export const write = (state, leaves) => {
  /** @type {Layout.WriteResult<Trickle>} */
  let result = { layout: { ...state }, nodes: [], leaves: [] }
  for (const content of leaves) {
    const leaf =
      content.byteLength === 0
        ? { id: EMTPY_LEAF_ID, content }
        : { id: ++result.layout.lastID, content }

    result.leaves.push(leaf)
    result = addLeaf(result, leaf.id)
  }

  return result
}

/**
 * @param {Layout.WriteResult<Trickle>} result
 * @param {Layout.NodeID} leaf
 * @returns {Layout.WriteResult<Trickle>}
 */
export const addLeaf = ({ nodes, leaves, layout }, leaf) => {
  // we are not yet at a node boundary just add a leaf to a tail
  if (layout.leafCount % layout.options.maxDirectLeaves !== 0) {
    return { nodes, leaves, layout: pushLeaf(layout, leaf) }
  }
  // if we got that far we are going to experience a node change
  // let's find out where the puck would go next
  else {
    const { depth, levelCutoffs } = findNextLeafTarget(layout)

    // either backtrack "up the tree" or just reiterate current step, pushing
    // the sibling into the parent's "direct leaves"
    const result =
      layout.tail.depth >= depth
        ? sealToLevel(
            { layout: { ...layout, levelCutoffs }, nodes, leaves },
            depth
          )
        : { layout: { ...layout, levelCutoffs }, nodes, leaves }

    let { lastID } = result.layout

    // now descend one step down for the final already-containing-a-leaf node

    return {
      ...result,
      layout: {
        ...result.layout,
        tail: new TrickleNode({
          id: ++lastID,
          depth: depth,
          directLeaves: [leaf],
          parent: result.layout.tail,
        }),
        leafCount: result.layout.leafCount + 1,
        lastID,
      },
    }
  }
}

/**
 * @param {Trickle} layout
 */
const findNextLeafTarget = ({ levelCutoffs, options, leafCount }) => {
  // we have enough members to trigger the next descent-level-group:
  // calculate and cache its size
  if (leafCount === levelCutoffs[levelCutoffs.length - 1]) {
    const cutoff =
      options.maxDirectLeaves *
      Math.pow(options.maxSiblingSubgroups + 1, levelCutoffs.length)
    return {
      depth: 1,
      levelCutoffs: [...levelCutoffs, cutoff],
    }
  }
  //  otherwise just find where we'd land
  else {
    let depth = 0
    let remainingLeaves = leafCount
    let level = levelCutoffs.length - 1
    while (level >= 0) {
      if (remainingLeaves >= levelCutoffs[level]) {
        depth++
      }
      remainingLeaves %= levelCutoffs[level]
      level--
    }

    return { depth, levelCutoffs }
  }
}
/**
 * @param {Trickle} layout
 * @param {Layout.NodeID} leaf
 * @returns {Trickle}
 */

const pushLeaf = (layout, leaf) => {
  return {
    ...layout,
    tail: layout.tail.append(leaf),
    leafCount: layout.leafCount + 1,
  }
}

/**
 * @param {Layout.WriteResult<Trickle>} input
 * @param {number} depth
 * @returns {Layout.WriteResult<Trickle>}
 */
const sealToLevel = ({ nodes: input, leaves, layout }, depth) => {
  let { lastID } = layout
  const nodes = [...input]

  let tail = new TrickleNode({
    .../** @type {TrickleNode} */ (layout.tail),
    id: ++lastID,
  })
  while (tail.depth >= depth) {
    const parent = /** @type {TrickleNode} */ (tail.parent)

    const node = {
      id: ++lastID,
      children: tail.directLeaves,
    }
    nodes.push(node)

    tail = new TrickleNode({
      ...parent,
      id: ++lastID,
      directLeaves: [...parent.directLeaves, node.id],
    })
  }

  return { layout: { ...layout, lastID, tail }, nodes, leaves }
}

/**
 * @param {Trickle} layout
 * @param {Layout.Metadata} [metadata]
 * @returns {Layout.CloseResult}
 */
export const close = (layout, metadata) => {
  if (layout.tail === null) {
    return {
      nodes: [],
      root: {
        id: layout.lastID + 1,
        children: [],
      },
    }

    // special case to match go-ipfs on zero-length streams
  } else if (
    layout.options.unixfsNulLeafCompat &&
    layout.leafCount === 1 &&
    layout.tail.directLeaves[0] === EMTPY_LEAF_ID
  ) {
    // convergence requires a pb-unixfs-file link/leaf regardless of how
    // the encoder is setup, go figure...
    const root = {
      id: layout.lastID + 1,
      children: [],
    }

    return { root, nodes: [] }
  } else {
    const { nodes } = sealToLevel({ layout, leaves: [], nodes: [] }, 0)
    const root = /** @type {Layout.Branch} */ (nodes.pop())
    root.metadata = metadata
    return {
      nodes,
      root,
    }
  }
}

/**
 * @implements {Layout.Branch}
 */
class TrickleNode {
  /**
   * @param {{
   * id: number
   * depth: number
   * directLeaves: Layout.NodeID[]
   * parent: TrickleNode | null
   * }} data
   */
  constructor({ id, depth, directLeaves, parent }) {
    this.id = id
    this.depth = depth
    this.directLeaves = directLeaves
    this.parent = parent
  }
  get children() {
    return this.directLeaves
  }

  /**
   *
   * @param {Layout.NodeID} leaf
   */

  append(leaf) {
    return new TrickleNode({
      ...this,
      directLeaves: [...this.directLeaves, leaf],
    })
  }
}
