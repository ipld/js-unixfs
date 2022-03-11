import { assert } from "chai"
import Matrix from "./dataset/convergence_rawdata.js"
import * as FileImporter from "../src/file.js"
import { parseConfig, unpackFile } from "./matrix.js"
import { CID, collect, encodeCar, writeFile } from "./util.js"
import { Readable } from "stream"

/**
 *
 * @param {import('./matrix').Input} spec
 */
const createTest = spec =>
  /**
   * @this {{timeout(ms:number):void}}
   */
  async function test() {
    this.timeout(50000)
    const config = await parseConfig(spec)
    const { writer, ...importer } = FileImporter.createImporter({}, config)
    const source = await unpackFile(config.url)

    const car = encodeCar(importer.blocks)
    const file = writeFile("temp.car", car)

    // @ts-expect-error - see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59057
    const stream = /** @type {ReadableStream<Uint8Array>} */ (source.stream())
    const reader = stream.getReader()
    while (true) {
      const read = await reader.read()
      if (read.done) {
        const link = await writer.close()
        // const cids = (await blocks).map(block => block.cid)
        // console.log(cids.map(String).join("\n"))

        await file
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

/** @type {(log:string) => Set<string>} */
const tesSet = log => new Set(log.trim().split("\n"))

const only = tesSet(`
ipfs add --chunker=size-262144 --trickle=true --raw-leaves=true --cid-version=1 ../testdata/large_repeat_1GiB.zst
`)

const timeouts = tesSet(`
ipfs --upgrade-cidv0-in-output=true add --chunker=size-65535 --trickle=true --raw-leaves=false --cid-version=0 ../testdata/large_repeat_1GiB.zst
ipfs add --chunker=size-65535 --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
jsipfs add --chunker=size-65535 --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
ipfs --upgrade-cidv0-in-output=true add --chunker=rabin-128-65535-524288 --trickle=true --raw-leaves=false --cid-version=0 ../testdata/large_repeat_1GiB.zst
`)

const missmatches = tesSet(`
ipfs --upgrade-cidv0-in-output=true add --chunker=size-262144 --trickle=true --raw-leaves=false --cid-version=0 ../testdata/large_repeat_1GiB.zst
ipfs add --chunker=size-262144 --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
jsipfs add --chunker=size-262144 --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
ipfs --upgrade-cidv0-in-output=true add --chunker=rabin --trickle=true --raw-leaves=false --cid-version=0 ../testdata/large_repeat_1GiB.zst
ipfs add --chunker=rabin --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
ipfs --upgrade-cidv0-in-output=true add --chunker=rabin-262141 --trickle=true --raw-leaves=false --cid-version=0 ../testdata/large_repeat_1GiB.zst
ipfs add --chunker=rabin-262141 --trickle=true --raw-leaves=false --cid-version=1 ../testdata/large_repeat_1GiB.zst
ipfs --upgrade-cidv0-in-output=true add --chunker=size-262144 --trickle=true --raw-leaves=true --cid-version=0 ../testdata/large_repeat_1GiB.zst
ipfs add --chunker=size-262144 --trickle=true --raw-leaves=true --cid-version=1 ../testdata/large_repeat_1GiB.zst
jsipfs add --chunker=size-262144 --trickle=true --raw-leaves=true --cid-version=1 ../testdata/large_repeat_1GiB.zst
ipfs --upgrade-cidv0-in-output=true add --chunker=rabin --trickle=true --raw-leaves=true --cid-version=0 ../testdata/large_repeat_1GiB.zst
`)

describe("convergence tests", () => {
  for (const config of Matrix) {
    const title = `${
      config.impl === "go" ? "ipfs" : "jsipfs"
    } ${config.cmd.trim()} ${config.source}`
    const test = createTest(config)

    if (only.has(title)) {
      it.only(title, test)
    } else if (isDisabledTest(config)) {
      // it.skip(title, test)
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
