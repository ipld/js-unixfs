// eslint-disable-next-line no-unused-vars
import * as API from "./api.js"
import * as RabinLib from "./rabin/rabin-wasm.js"

const AVARAGE = 262144
const WINDOW = 16
const POLYNOM = 17437180132763653

/**
 * @typedef {object} Rabin
 * @property {number} min
 * @property {number} max
 * @property {number} bits
 * @property {number} window
 * @property {number} polynomial
 *
 * @typedef {object} RabinConfig
 * @property {number} avg
 * @property {number} min
 * @property {number} max
 * @property {number} window
 * @property {number} polynomial
 */

/**
 * @param {Partial<RabinConfig>} config
 * @returns {Promise<API.StatefulChunker<RabinLib.Rabin>>}
 */
export const create = async ({
  avg = AVARAGE,
  min = avg / 3,
  max = avg + avg / 2,
  window = WINDOW,
  polynomial = POLYNOM,
} = {}) => ({
  type: "Stateful",
  context: await RabinLib.create(
    Math.floor(Math.log2(avg)),
    min,
    max,
    window,
    polynomial
  ),
  cut,
})

/**
 * @param {RabinLib.Rabin} rabin
 * @param {Uint8Array} buffer
 */
export const cut = (rabin, buffer) => rabin.fingerprint(buffer)
