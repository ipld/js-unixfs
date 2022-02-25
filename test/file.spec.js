/* eslint-env mocha */

import * as fs from "fs"
import * as unixfs from "../src/lib.js"
import * as FileImporter from "../src/file.js"
import { expect, assert } from "chai"
import { encodeUTF8, File } from "./util.js"

const CHUNK_SIZE = 262144
describe("test file importer", () => {
  it("basic file", async function () {
    this.timeout(30000)
    const content = encodeUTF8("this file does not have much content\n")

    const { writer, blocks } = FileImporter.createImporter()
    await writer.write(content)
    const link = await writer.close()

    assert.equal(link.contentByteLength, 37)
    assert.equal(link.dagByteLength, 45)
    assert.equal(
      link.cid.toString(),
      "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
    )

    const reader = blocks.getReader()
    const read = await reader.read()
    if (read.done) {
      assert.fail("expected to get a block")
    }

    const block = read.value
    assert.deepEqual(
      block.cid.toString(),
      "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
    )

    const end = await reader.read()
    assert.deepEqual(end, { done: true, value: undefined })
  })
})
