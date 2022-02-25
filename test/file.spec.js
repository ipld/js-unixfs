/* eslint-env mocha */

import * as fs from "fs"
import * as unixfs from "../src/lib.js"
import * as FileImporter from "../src/file.js"
import { expect, assert } from "chai"
import { encodeUTF8, File, CID } from "./util.js"

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

  it("splits into 3 chunks", async function () {
    const { writer, blocks } = FileImporter.createImporter()
    writer.write(new Uint8Array(CHUNK_SIZE).fill(1))
    writer.write(new Uint8Array(CHUNK_SIZE).fill(2))
    writer.write(new Uint8Array(CHUNK_SIZE).fill(3))
    const link = await writer.close()

    // TODO: So go-ipfs sets CIDv0 links which casuse a mismatch
    assert.deepEqual(link, {
      contentByteLength: 786432,
      dagByteLength: 786632,
      cid: CID.parse(
        "bafybeiegda62p2cdi5sono3h3hqjnxwc56z4nocynrj44rz7rtc2p246cy"
      ),
    })

    const reader = blocks.getReader()
    const r1 = await reader.read()
    if (r1.done) {
      assert.fail("expected to get a block")
    }

    assert.deepEqual(
      r1.value.cid,
      CID.parse("bafybeihhsdoupgd3fnl3e3367ymsanmikafpllldsdt37jzyoh6nuatowe")
    )

    const r2 = await reader.read()
    if (r2.done) {
      assert.fail("expected to get a block")
    }
    assert.deepEqual(
      r2.value.cid,
      CID.parse("bafybeief3dmadxfymhhhrflqytqmlhlz47w6glaxvyzmm6s6tpfb6izzee")
    )

    const r3 = await reader.read()
    if (r3.done) {
      assert.fail("expected to get a block")
    }
    assert.deepEqual(
      r3.value.cid,
      CID.parse("bafybeihznihf5g5ibdyoawn7uu3inlyqrxjv63lt6lop6h3w6rzwrp67a4")
    )
  })
})
