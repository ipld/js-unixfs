
// eslint-disable-next-line no-unused-vars
import * as API from './api.js'
import * as RabinLib from './rabin/rabin-wasm.js'

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
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} window
 * @property {number} polynomial
 */

/**
 * @param {RabinConfig} config
 * @returns {Promise<API.StatefulChunker<RabinLib.Rabin>>}
 */
export const withConfig = async ({
  avg,
  min = avg / 3,
  max = avg + (avg / 2),
  window,
  polynomial
}) => ({
  type: 'Stateful',
  context: await RabinLib.create(
    Math.floor(Math.log2(avg)),
    min,
    max,
    window,
    polynomial
  ),
  cut
})

/**
 * @param {RabinLib.Rabin} rabin
 * @param {Uint8Array} buffer
 */
export const cut = (rabin, buffer) => rabin.fingerprint(buffer)
