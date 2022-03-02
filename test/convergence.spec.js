import { assert } from "chai"
import Matrix from "./dataset/convergence_rawdata.js"
import * as FileImporter from "../src/file.js"
import { parseConfig, unpackFile } from "./matrix.js"
import * as FS from "fs"

/**
 *
 * @param {import('./matrix').Input} input
 */
const createTest = input =>
  async function () {
    this.timeout(30000)
    const config = await parseConfig(input)
    const { writer, blocks } = FileImporter.createImporter({}, config)
    const file = await unpackFile(config.url)

    // console.log(">> file", file.size)
    // const stream = await FS.createReadStream("./large_repeat_1GiB")
    // for await (const slice of stream) {
    //   writer.write(slice)
    // }

    // @ts-expect-error - see https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59057
    const stream = /** @type {ReadableStream<Uint8Array>} */ (file.stream())
    const reader = stream.getReader()
    while (true) {
      const read = await reader.read()
      if (read.done) {
        const link = await writer.close()
        assert.deepEqual(link.cid, config.cid)
        break
      } else {
        console.log("<<", read.value.byteLength)
        writer.write(read.value)
      }
    }
  }

describe("convergence tests", () => {
  for (const input of Matrix.slice(0, 1)) {
    const title = `${input.cmd} ${input.source}`
    console.log(title)

    if (input.inlining > 0) {
      it.skip(title, createTest(input))
    } else {
      it(title, createTest(input))
    }
  }
})
