import { defer } from "./util.js"
import * as UnixFS from "../unixfs.js"
import * as API from "./api.js"
import { ReadableStream } from "@web-std/stream"
export * from "./api.js"

/**
 * @template T
 * @implements {UnderlyingSource<T>}
 * @implements {API.Channel<T>}
 */
class Channel {
  /**
   * @param {QueuingStrategy<T>} queuingStrategy
   */
  constructor(queuingStrategy) {
    /** @type {ReadableStream<T>} */
    this.reader = new ReadableStream(this, queuingStrategy)
    /** @type {Writer<T>} */
    // eslint-disable-next-line no-unused-expressions
    this.writer // This is initilaized in start
  }

  /**
   * @param {ReadableStreamController<T>} controller
   */
  start(controller) {
    if (this.writer) {
      throw Error("Can not start already started")
    }
    this.writer = new Writer(controller)
  }

  pull() {
    this.writer.sync()
  }

  /**
   *
   * @param {Error} reason
   */
  cancel(reason) {
    this.writer.error(reason)
  }
}

/**
 * @template T
 */

class Writer {
  /**
   * @param {ReadableStreamController<T>} queue
   */
  constructor(queue) {
    /** @private */
    this.deferred = defer()
    this.queue = queue

    /** @type {'ready'|'full'} */
    this.status = "ready"
    // It is not blocked initially
    this.deferred.succeed(undefined)
  }

  get desiredSize() {
    return this.queue.desiredSize || 0
  }

  /**
   * @param {T} item
   * @returns {Promise<void>}
   */
  enqueue(item) {
    this.queue.enqueue(item)
    this.sync()

    return this.ready
  }

  get ready() {
    return this.deferred.promise
  }

  close() {
    this.queue.close()
    this.deferred.fail(new Error("Writer was closed"))
  }

  /**
   * @param {Error} error
   */
  error(error) {
    this.queue.error(error)
    this.deferred.fail(error)
  }

  sync() {
    switch (this.status) {
      case "ready": {
        if (this.desiredSize <= 0) {
          this.deferred = defer()
          this.status = "full"
        }
        break
      }
      case "full": {
        if (this.desiredSize > 0) {
          this.deferred.succeed(undefined)
          this.status = "ready"
        }
        break
      }
      default: {
        throw new Error("Should be unreachable")
      }
    }
  }
}

/**
 * This is a simpler wrapper around the stream controller
 * that drops already omitted blocks.
 *
 * @implements {API.Queue<UnixFS.Block>}
 * @extends {Writer<UnixFS.Block>}
 */
class BlockQueue extends Writer {
  /**
   * @param {ReadableStreamController<UnixFS.Block>} queue
   */
  constructor(queue) {
    super(queue)
    /** @type {Set<string>} */
    this.written = new Set()
  }

  /**
   * @param {UnixFS.Block} block
   */
  enqueue(block) {
    const id = block.cid.toString()
    if (!this.written.has(id)) {
      this.queue.enqueue(block)
      this.written.add(id)
      this.sync()
    }

    return this.ready
  }
}

/**
 * @implements {UnderlyingSource<UnixFS.Block>}
 * @extends {Channel<UnixFS.Block>}
 */
class BlockChannel extends Channel {
  /**
   * @param {ReadableStreamController<UnixFS.Block>} controller
   */
  start(controller) {
    if (this.writer) {
      throw Error("Can not start already started")
    }
    this.writer = new BlockQueue(controller)
  }
}

/**
 * @param {UnixFS.Block} block
 */
export const blockSize = block => block.bytes.length

// BlockSizeLimit specifies the maximum size an imported block can have.
// @see https://github.com/ipfs/go-unixfs/blob/68c015a6f317ed5e21a4870f7c423a4b38b90a96/importer/helpers/helpers.go#L7-L8
export const BLOCK_SIZE_LIMIT = 1048576 // 1 MB
export const defaultCapacity = BLOCK_SIZE_LIMIT * 100

/**
 * @param {QueuingStrategy<UnixFS.Block>} queuingStrategy
 * @returns {API.Channel<UnixFS.Block>}
 */
export const createBlockChannel = ({
  size = blockSize,
  highWaterMark = defaultCapacity,
} = {}) => new BlockChannel({ size, highWaterMark })

/**
 * @template T
 * @param {QueuingStrategy<T>} [strategy]
 * @returns {API.Channel<T>}
 */
export const createChannel = (strategy = {}) => new Channel(strategy)
