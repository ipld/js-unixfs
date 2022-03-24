import { Indexed } from "./indexed.js"

/**
 * @typedef {{
 * readonly byteOffset: number
 * readonly byteLength: number
 * readonly segments: Uint8Array[]
 * }} BufferSlice
 */

/** @typedef {BufferView} View */
export const empty = () => new BufferView()

/**
 * @param {Uint8Array[]} segments
 * @param {number} byteOffset
 * @param {number} byteLength
 */
export const create = (
  segments,
  byteOffset = 0,
  byteLength = totalByteLength(segments)
) => new BufferView(segments, byteOffset, byteLength)

/**
 *
 * @param {Uint8Array[]} segments
 * @returns
 */
const totalByteLength = segments => {
  let byteLength = 0
  for (const segment of segments) {
    byteLength += segment.byteLength
  }
  return byteLength
}

/**
 * @param {BufferSlice} buffer
 * @param {number} [startOffset]
 * @param {number} [endOffset]
 */
export const slice = (
  buffer,
  startOffset = 0,
  endOffset = buffer.byteLength
) => {
  const segments = []
  const start = startOffset < 0 ? buffer.byteLength - startOffset : startOffset
  const end = endOffset < 0 ? buffer.byteLength - endOffset : endOffset

  // If start at 0 offset and end is past buffer range it is effectively
  // as same buffer.
  if (start === 0 && end >= buffer.byteLength) {
    return buffer
  }

  // If range is not within the current buffer just create an empty slice.
  if (start > end || start > buffer.byteLength || end <= 0) {
    return empty()
  }

  let byteLength = 0
  let offset = 0
  for (const segment of buffer.segments) {
    const nextOffset = offset + segment.byteLength
    // Have not found a start yet
    if (byteLength === 0) {
      // If end offset is within the current segment we know start is also,
      // because it preceeds the end & we had not found start yet.
      // In such case we create a view with only single segment of bytes
      // in the range.
      if (end <= nextOffset) {
        const range = segment.subarray(start - offset, end - offset)
        segments.push(range)
        byteLength = range.byteLength
        break
      }
      // If start offeset falls with in current range (but not the end)
      // we save matching buffer slice and update byteLength.
      else if (start < nextOffset) {
        const range =
          start === offset ? segment : segment.subarray(start - offset)
        segments.push(range)
        byteLength = range.byteLength
      }
    }
    // Otherwise we already started collecting matching segments and are looking
    // for the end end of the slice. If it is with in the current range capture
    // the segment and create a view.
    else if (end <= nextOffset) {
      const range =
        end === nextOffset ? segment : segment.subarray(0, end - offset)
      segments.push(range)
      byteLength += range.byteLength
      break
    }
    // If end is past current range we just save the segment and continue.
    else {
      segments.push(segment)
      byteLength += segment.byteLength
    }

    offset = nextOffset
  }

  return new BufferView(segments, buffer.byteOffset + start, byteLength)
}

/**
 * @param {BufferSlice} buffer
 * @param {Uint8Array} part
 */

export const push = (buffer, part) => {
  if (part.byteLength > 0) {
    // We MUTATE here but that is ok because it is out of bound for the passed
    // buffer view so there will be no visible side effects.
    buffer.segments.push(part)
    return new BufferView(
      buffer.segments,
      buffer.byteOffset,
      buffer.byteLength + part.byteLength
    )
  } else {
    return buffer
  }
}

/**
 * @param {BufferSlice} buffer
 * @param {number} n
 */
export const get = (buffer, n) => {
  if (n < buffer.byteLength) {
    let offset = 0
    for (const segment of buffer.segments) {
      if (n < offset + segment.byteLength) {
        return segment[n - offset]
      } else {
        offset += segment.byteLength
      }
    }
  }

  return undefined
}

/**
 *
 * @param {BufferView} buffer
 * @param {Uint8Array} target
 * @param {number} byteOffset
 */
export const copyTo = (buffer, target, byteOffset) => {
  let offset = byteOffset
  for (const segment of buffer.segments) {
    target.set(segment, offset)
    offset += segment.byteLength
  }

  return target
}

/**
 *
 * @param {BufferView} buffer
 */
export function* iterate(buffer) {
  for (const part of buffer.segments) {
    yield* part
  }
}

/**
 * @extends {Indexed<number>}
 */
class BufferView extends Indexed {
  /**
   * @param {Uint8Array[]} segments
   * @param {number} byteOffset
   * @param {number} byteLength
   */
  constructor(segments = [], byteOffset = 0, byteLength = 0) {
    super()
    /** @hide */
    this.segments = segments
    /** @readonly */
    this.byteLength = byteLength
    /** @readonly */
    this.length = byteLength
    /** @readonly */
    this.byteOffset = byteOffset
  }

  [Symbol.iterator]() {
    return iterate(this)
  }

  /**
   * @param {number} [start]
   * @param {number} [end]
   */
  slice(start, end) {
    return /** @type {BufferView} */ (slice(this, start, end))
  }

  /**
   * @param {number} [start]
   * @param {number} [end]
   */
  subarray(start, end) {
    return /** @type {BufferView} */ (slice(this, start, end))
  }

  /**
   *
   * @param {Uint8Array} bytes
   */
  push(bytes) {
    return /** @type {BufferView} */ (push(this, bytes))
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
    return copyTo(this, target, offset)
  }
}
