import { assert } from "chai"
import Matrix from "./dataset/convergence_rawdata.js"
import * as FileImporter from "../src/file.js"
import { parseConfig, unpackFile } from "./matrix.js"
import { CID, collect } from "./util.js"
import * as FS from "fs"

/**
 *
 * @param {import('./matrix').Input} input
 */
const createTest = input =>
  /**
   * @this {{timeout(ms:number):void}}
   */
  async function test() {
    this.timeout(50000)
    const config = await parseConfig(input)
    const { writer, blocks } = FileImporter.createImporter({}, config)
    const file = await unpackFile(config.url)
    collect(blocks)

    // @ts-expect-error - see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59057
    const stream = /** @type {ReadableStream<Uint8Array>} */ (file.stream())
    const reader = stream.getReader()
    while (true) {
      const read = await reader.read()
      if (read.done) {
        const link = await writer.close()
        assert.deepEqual(toV1(link.cid), config.cid)
        break
      } else {
        writer.write(read.value)
      }
    }
  }

/**
 * @typedef {Matrix[number]} Config
 * @param {Config} config
 */

const isJSRabinTest = config =>
  config.chunker.startsWith("rabin") && config.impl === "js"

/**
 * @param {Config} config
 */
const isBuzzhashTest = config => config.chunker.startsWith("buzhash")

/**
 * @param {Config} config
 */
const isInlineCIDTest = config => config.inlining > 0

/**
 * @param {Config} config
 */
const isDisabledTest = config =>
  isInlineCIDTest(config) || isBuzzhashTest(config) || isJSRabinTest(config)

describe("convergence tests", () => {
  for (const config of Matrix) {
    const title = `${
      config.impl === "go" ? "ipfs" : "jsipfs"
    } ${config.cmd.trim()} ${config.source}`
    const test = createTest(config)

    if (isDisabledTest(config)) {
      it.skip(title, test)
    } else {
      it(title, test)
    }
  }
})

/**
 * @param {import('../src/unixfs').CID} cid
 */

const toV1 = cid =>
  cid.version === 0 ? CID.createV1(cid.code, cid.multihash) : cid
