import * as API from "./api.js"

/**
 * @param {string} reason
 * @returns {never}
 */
export const panic = reason => {
  throw new Error(reason)
}

/**
 * @param {{ raw: readonly string[] | ArrayLike<string>}} template
 * @param {never} [subject]
 * @param {unknown[]} substitutions
 * @returns {never}
 */
export const unreachable = (template, subject, ...substitutions) =>
  panic(String.raw(template, JSON.stringify(subject), ...substitutions))

export const EMPTY_BUFFER = new Uint8Array(0)
/** @type {any[]} */
export const EMPTY = []

/**
 * @template T, X
 */
class Defer {
  constructor() {
    /**
     * @type {{succeed(value:T): void, fail(error:X): void}}
     */
    this.deferred
    /** @type {Promise<T>} */
    this.promise = new Promise((succeed, fail) => {
      this.deferred = { succeed, fail }
    })
  }

  /**
   * @param {T} value
   */
  succeed(value) {
    this.deferred.succeed(value)
  }
  /**
   *
   * @param  {X} error
   */
  fail(error) {
    this.deferred.fail(error)
  }

  /**
   * @param {any[]} args
   */
  then(...args) {
    return this.promise.then(...args)
  }
}

/**
 * @template [T=void]
 * @template [X=Error]
 */
export const defer = () => /** @type {API.Defer<T, X>} */ (new Defer())
