import { build } from "protobufjs"
import * as Chunker from "../chunker/api.js"

/**
 * @typedef {{
 * lastID: number
 * }} Builder
 *
 * @typedef {Builder & {node:Node}} Build
 * @typedef {{
 * id:number
 * chunk: Chunker.Chunk
 * type: "leaf"
 * }} Leaf
 *
 * @typedef {{
 * id:number
 * children: number[]
 * type: "branch"
 * }} Branch
 *
 * @typedef {Leaf|Branch} Node
 */

/**
 * @param {Builder} builder
 * @param {Chunker.Chunk} chunk
 * @returns {Build}
 */
const createLeaf = (builder, chunk) => ({
  lastID: builder.lastID + 1,
  node: new LeafNode(builder.lastID + 1, chunk),
})

/**
 *
 * @param {Builder} builder
 * @param {number[]} children
 * @returns {Build}
 */
const createBranch = (builder, children) => ({
  lastID: builder.lastID + 1,
  node: new BranchNode(builder.lastID + 1, children),
})

class LeafNode {
  /**
   * @param {number} id
   * @param {Chunker.Chunk} chunk
   */
  constructor(id, chunk) {
    this.id = id
    this.chunk = chunk
    /** @type {"leaf"} */
    this.type = "leaf"
  }
}

class BranchNode {
  /**
   * @param {number} id
   * @param {number[]} children
   */
  constructor(id, children) {
    this.id = id
    this.children = children
    /** @type {"branch"} */
    this.type = "branch"
  }
}
