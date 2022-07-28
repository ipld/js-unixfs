import * as Layout from "./api.js"
import * as Chunker from "../chunker/api.js"
import { EMPTY } from "../../writer/util.js"

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
export const defaults = {
  maxSiblingSubgroups: 4,
  maxDirectLeaves: 174,
  unixfsNulLeafCompat: true,
}

/**
 * @param {Partial<Options>} options
 * @returns {Layout.LayoutEngine<Trickle>}
 */
export const configure = ({
  maxSiblingSubgroups = 4,
  maxDirectLeaves = 174,
  unixfsNulLeafCompat = false,
}) => ({
  open: () =>
    open({
      maxDirectLeaves,
      maxSiblingSubgroups,
      unixfsNulLeafCompat,
    }),
  write,
  close,
})

/**
 * @typedef {{
 * options: Options
 * leafCount: number
 * levelCutoffs: number[]
 * tail: TrickleNode
 * lastID: number
 * }} Trickle
 *
 * @param {Options} [options]
 * @returns {Trickle}
 */
export const open = (options = defaults) => ({
  options,
  leafCount: 0,
  levelCutoffs: [options.maxDirectLeaves],
  tail: new TrickleNode({
    depth: 0,
    directLeaves: [],
    // this is a synthetic parent to hold the final-most-est digest CID
    parent: new TrickleNode({
      depth: -1,
      directLeaves: [],
    }),
  }),
  lastID: 0,
})

/**
 * @param {Trickle} layout
 * @param {Chunker.Chunk[]} chunks
 * @returns {Layout.WriteResult<Trickle>}
 */
export const write = (layout, chunks) => {
  /** @type {Layout.WriteResult<Trickle>} */
  let result = { layout: { ...layout }, nodes: [], leaves: [] }
  for (const chunk of chunks) {
    if (chunk.byteLength > 0) {
      const leaf = { id: ++result.layout.lastID, content: chunk }
      result.leaves.push(leaf)
      result = addLeaf(result, leaf.id)
    }
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
  if (
    layout.leafCount === 0 ||
    layout.leafCount % layout.options.maxDirectLeaves !== 0
  ) {
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
  depth = depth < 0 ? 0 : depth
  const nodes = [...input]
  let { tail, lastID } = layout

  while (tail.depth >= depth) {
    const { parent } = tail

    const node = {
      id: ++lastID,
      children: tail.directLeaves,
    }
    nodes.push(node)

    tail = new TrickleNode({
      ...parent,
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
  // special case to match go-ipfs on zero-length streams
  if (layout.options.unixfsNulLeafCompat && layout.leafCount === 0) {
    // convergence requires a pb-unixfs-file link/leaf regardless of how
    // the encoder is setup, go figure...
    const root = {
      id: layout.lastID + 1,
      metadata,
    }

    return { root, nodes: EMPTY, leaves: EMPTY }
  } else {
    const { nodes } = sealToLevel({ layout, leaves: [], nodes: [] }, 0)
    const { id, children } = /** @type {Layout.Branch} */ (nodes.pop())
    return {
      leaves: EMPTY,
      nodes,
      root: { id, children, metadata },
    }
  }
}

class TrickleNode {
  /**
   * @param {{
   * depth: number
   * directLeaves: Layout.NodeID[]
   * parent?: TrickleNode
   * }} data
   */
  constructor({ depth, directLeaves, parent }) {
    this.depth = depth
    this.directLeaves = directLeaves
    /** @type {TrickleNode} */
    this.parent = parent || this
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
