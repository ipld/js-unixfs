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
