import { File } from "@web-std/file"

const utf8Encoder = new TextEncoder()

/**
 * @param {string} input
 */
export const encodeUTF8 = input => utf8Encoder.encode(input)

export { File }
