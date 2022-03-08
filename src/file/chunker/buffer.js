import { Indexed } from "./indexed.js"

/**
 * @extends {Indexed<number>}
 */
class BufferView extends Indexed {
  /**
   * @param {Uint8Array[]} parts
   * @param {number} byteOffset
   * @param {number} byteLength
   */
  constructor(parts = [], byteOffset = 0, byteLength = 0) {
    super()
    this.parts = parts
    this.byteLength = byteLength
    this.byteOffset = byteOffset
  }

  get length() {
    return this.byteLength
  }
  *[Symbol.iterator]() {
    for (const part of this.parts) {
      yield* part
    }
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  slice(start, end) {
    return slice(this, start, end)
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  subarray(start, end) {
    return slice(this, start, end)
  }

  /**
   *
   * @param {Uint8Array} bytes
   */
  push(bytes) {
    return push(this, bytes)
  }

  /**
   * @param {number} n
   */
  get(n) {
    return get(this, n)
  }

  /**
   *
   * @param {Uint8Array} target
   * @param {number} offset
   */
  copyTo(target, offset) {
    for (const part of this.parts) {
      target.set(part, offset)
      offset += part.byteLength
    }
    return target
  }
}

/** @typedef {BufferView} View */

/**
 *
 * @param {BufferView} buffer
 * @param {Uint8Array} part
 * @returns {BufferView}
 */

export const push = (buffer, part) => {
  if (part.byteLength > 0) {
    // We mutate array here but previous buffer is still a view over
    // the same data.
    buffer.parts.push(part)
    return new BufferView(
      buffer.parts,
      buffer.byteOffset,
      buffer.byteLength + part.byteLength
    )
  } else {
    return buffer
  }
}

/**
 * @param {BufferView} buffer
 * @param {number} n
 */
export const get = (buffer, n) => {
  let offset = 0
  if (n > buffer.byteLength) {
    return undefined
  }

  for (const part of buffer.parts) {
    if (n < offset + part.byteLength) {
      return part[n - offset]
    } else {
      offset += part.byteLength
    }
  }
  return undefined
}

/**
 * @param {BufferView} buffer
 * @param {number} n
 * @returns {readonly [number, number]}
 */

const cursor = ({ parts, length }, n) => {
  if (n === 0) {
    return HEAD
  }

  const count = parts.length
  let offest = 0
  let index = 0
  while (index < count) {
    const part = parts[index]
    const nextOffset = offest + part.length
    if (n < nextOffset || index === count - 1) {
      break
    }
    offest = nextOffset
    index++
  }

  return [index, n - offest]
}

const HEAD = /** @type {[number, number]} */ (Object.freeze([0, 0]))

/**
 *
 * @param {BufferView} buffer
 * @param {number} [startOffset]
 * @param {number} [endOffset]
 * @returns {BufferView}
 */
export const slice = (
  buffer,
  startOffset = buffer.byteOffset,
  endOffset = buffer.byteLength
) => {
  const parts = []
  const start = startOffset < 0 ? buffer.byteLength - startOffset : startOffset
  const end = endOffset < 0 ? buffer.byteLength - endOffset : endOffset

  // Empty range
  if (start > end || start > buffer.byteLength || end <= 0) {
    return new BufferView()
  }

  let byteLength = 0
  let offset = 0
  for (const part of buffer.parts) {
    const nextOffset = offset + part.byteLength
    // Have not found a start yet
    if (byteLength === 0) {
      if (end <= nextOffset) {
        const slice = part.subarray(start - offset, end - offset)
        return new BufferView([slice], 0, slice.byteLength)
      } else if (start < nextOffset) {
        const slice = start === offset ? part : part.subarray(start - offset)
        byteLength = slice.byteLength
        parts.push(slice)
      }
    }
    // If end offest is in this range
    else if (end <= nextOffset) {
      const slice = end === nextOffset ? part : part.subarray(0, end - offset)
      byteLength += slice.byteLength
      parts.push(slice)
      return new BufferView(parts, 0, byteLength)
    } else {
      parts.push(part)
      byteLength += part.byteLength
    }

    offset = nextOffset
  }

  throw new Error("This code should be unreachable")
}

export const empty = () => new BufferView()
