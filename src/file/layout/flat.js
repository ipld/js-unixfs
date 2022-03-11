import * as Layout from "./api.js"
import * as Chunker from "../chunker/api.js"

export const name = "flat"

/**
 * @typedef {{}} Options
 */
export const options = {}

/**
 * @typedef {{
 * options: Options
 * lastID: number
 * children: number[]
 * index: number[]
 * }} Flat
 *
 * @param {Options} options
 * @returns {Flat}
 */
export const open = options => ({
  options,
  lastID: 0,
  children: [],
  index: [],
})

/**
 * @param {Flat} state
 * @param {Chunker.Chunk[]} chunks
 * @returns {Layout.WriteResult<Flat>}
 */
export const write = ({ lastID, ...layout }, chunks) => {
  const children = { ...layout.children }
  const leaves = []
  for (const content of chunks) {
    lastID++
    children.push(lastID)
    leaves.push({ id: lastID, content })
  }
  return {
    layout: { ...layout, lastID, children },
    nodes: EMPTY,
    leaves,
  }
}

/**
 * @param {Flat} self
 * @param {Layout.Metadata} [metadata]
 * @returns {Layout.CloseResult}
 */
export const close = ({ children }, metadata) => {
  return {
    root: { id: 0, children, metadata },
    nodes: EMPTY,
  }
}

/** @type {never[]} */
const EMPTY = []
