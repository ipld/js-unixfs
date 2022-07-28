/* eslint-env mocha */

import { assert } from "chai"
import { encodeUTF8, CID, hashrecur, collect } from "./util.js"
import * as UnixFS from "../src/lib.js"
import * as Trickle from "../src/file/layout/trickle.js"
import * as Balanced from "../src/file/layout/balanced.js"
import * as FixedSize from "../src/file/chunker/fixed.js"
import * as Rabin from "../src/file/chunker/rabin.js"
import { sha256 } from "multiformats/hashes/sha2"
import { write } from "../src/file.js"
import * as Channel from "../src/writer/channel.js"

const CHUNK_SIZE = 262144
describe("test file", () => {
  it("basic file", async function () {
    this.timeout(30000)
    const content = encodeUTF8("this file does not have much content\n")
    const { readable, writable } = Channel.createBlockChannel()

    const fs = UnixFS.createWriter({ writable })
    const file = UnixFS.createFileWriter(fs)
    await file.write(content)
    const link = await file.close()
    fs.close()

    assert.equal(link.contentByteLength, 37)
    assert.equal(link.dagByteLength, 45)
    assert.equal(
      link.cid.toString(),
      "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
    )

    const blocks = readable.getReader()
    const read = await blocks.read()
    if (read.done) {
      assert.fail("expected to get a block")
    }

    const block = read.value
    assert.deepEqual(
      block.cid.toString(),
      "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
    )

    const end = await blocks.read()
    assert.deepEqual(end, { done: true, value: undefined })
  })

  it("splits into 3 chunks", async function () {
    const { readable, writable } = Channel.createBlockChannel()
    const fs = UnixFS.createWriter({ writable })
    const file = UnixFS.createFileWriter(fs)
    file.write(new Uint8Array(CHUNK_SIZE).fill(1))
    file.write(new Uint8Array(CHUNK_SIZE).fill(2))
    file.write(new Uint8Array(CHUNK_SIZE).fill(3))
    const link = await file.close()

    // TODO: So go-ipfs sets CIDv0 links which casuse a mismatch
    assert.deepEqual(link, {
      contentByteLength: 786432,
      dagByteLength: 786632,
      cid: CID.parse(
        "bafybeiegda62p2cdi5sono3h3hqjnxwc56z4nocynrj44rz7rtc2p246cy"
      ),
    })

    const blocks = readable.getReader()
    const r1 = await blocks.read()
    if (r1.done) {
      assert.fail("expected to get a block")
    }

    assert.deepEqual(
      r1.value.cid,
      CID.parse("bafybeihhsdoupgd3fnl3e3367ymsanmikafpllldsdt37jzyoh6nuatowe")
    )

    const r2 = await blocks.read()
    if (r2.done) {
      assert.fail("expected to get a block")
    }
    assert.deepEqual(
      r2.value.cid,
      CID.parse("bafybeief3dmadxfymhhhrflqytqmlhlz47w6glaxvyzmm6s6tpfb6izzee")
    )

    const r3 = await blocks.read()
    if (r3.done) {
      assert.fail("expected to get a block")
    }
    assert.deepEqual(
      r3.value.cid,
      CID.parse("bafybeihznihf5g5ibdyoawn7uu3inlyqrxjv63lt6lop6h3w6rzwrp67a4")
    )

    await fs.close()
  })

  it("--chunker=size-65535 --trickle=false --raw-leaves=false --cid-version=1", async () => {
    const chunkSize = 65535
    const { readable, writable } = Channel.createBlockChannel()
    const fs = UnixFS.createWriter({
      writable,
      settings: {
        chunker: FixedSize.withMaxChunkSize(chunkSize),
        fileChunkEncoder: UnixFS.UnixFSLeaf,
        smallFileEncoder: UnixFS.UnixFSLeaf,
        fileLayout: Balanced,
        linker: { createLink: CID.createV1 },
        hasher: sha256,
        fileEncoder: UnixFS,
      },
    })
    const file = UnixFS.createFileWriter(fs)

    const size = Math.round(chunkSize * 2.2)
    const FRAME = Math.round(size / 10)
    let offset = 0
    let n = 0
    while (offset < size) {
      const slice = new Uint8Array(Math.min(FRAME, size - offset)).fill(++n)
      file.write(slice)
      offset += FRAME
    }

    const link = await file.close()
    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeiduffmtppi4cwa6olo3ggmoehvtdtcd47y6ddoodhyvcv7y3zvgnq"
      ),
      contentByteLength: 144177,
      dagByteLength: 144372,
    })

    await fs.close()
  })

  it("chunks with rabin chunker", async function () {
    this.timeout(30000)
    const content = hashrecur({
      byteLength: CHUNK_SIZE * 2,
    })
    const chunker = await Rabin.create()

    const { readable, writable } = Channel.createBlockChannel()

    const fs = UnixFS.createWriter({
      writable,
      settings: UnixFS.configure({ chunker }),
    })
    const collector = collect(readable)
    const file = UnixFS.createFileWriter(fs)

    for await (const slice of content) {
      file.write(slice)
    }
    const link = await file.close()
    fs.close()
    const blocks = await collector

    assert.deepEqual(
      link.cid,
      CID.parse("bafybeicj5kf4mohavbbh4j5izwy3k23cysewxfhgtmlaoxq6sewx2tsr7u")
    )

    assert.deepEqual((await blocks).length, 4)
  })

  it("trickle layout", async function () {
    this.timeout(30000)
    const content = hashrecur({
      byteLength: CHUNK_SIZE * 2,
    })
    const { readable, writable } = Channel.createBlockChannel()

    const fs = UnixFS.createWriter({
      writable,
      settings: UnixFS.configure({
        chunker: FixedSize.withMaxChunkSize(1300),
        fileLayout: Trickle,
        fileChunkEncoder: UnixFS.UnixFSRawLeaf,
      }),
    })
    const file = UnixFS.createFileWriter(fs)
    const collector = collect(readable)

    for await (const slice of content) {
      file.write(slice)
    }
    const link = await file.close()
    fs.close()
    const blocks = await collector

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeidia54tfr7ycw2ls2mxyjpcto42mriytx2ymlwgwsjqzner5wqc5u"
      ),
      contentByteLength: 524288,
      dagByteLength: 548251,
    })
  })

  it("trickle layout with overflow", async function () {
    this.timeout(30000)
    const content = hashrecur({
      byteLength: CHUNK_SIZE * 2,
    })
    const { readable, writable } = Channel.createBlockChannel()

    const fs = UnixFS.createWriter({
      writable,
      settings: UnixFS.configure({
        chunker: FixedSize.withMaxChunkSize(100000),
        fileLayout: Trickle.configure({ maxDirectLeaves: 5 }),
        fileChunkEncoder: UnixFS.UnixFSRawLeaf,
      }),
    })
    const collector = collect(readable)
    const file = UnixFS.createFileWriter(fs)

    for await (const slice of content) {
      file.write(slice)
    }
    const link = await file.close()
    fs.close()
    const blocks = await collector

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeigu6bkvpxtamauopeu2ejzkxy4wgqa576wmfc6ubusjwhgold4aum"
      ),
      contentByteLength: 524288,
      dagByteLength: 524738,
    })
  })

  it("trickle with several levels deep", async function () {
    this.timeout(30000)
    const chunkSize = 128
    const maxLeaves = 4
    const leafCount = 42

    const content = hashrecur({ byteLength: chunkSize * leafCount })
    const { readable, writable } = Channel.createBlockChannel()

    const fs = UnixFS.createWriter({
      writable,
      settings: UnixFS.configure({
        chunker: FixedSize.withMaxChunkSize(chunkSize),
        fileLayout: Trickle.configure({ maxDirectLeaves: maxLeaves }),
        fileChunkEncoder: UnixFS.UnixFSRawLeaf,
      }),
    })

    const collector = collect(readable)
    const file = UnixFS.createFileWriter(fs)

    for await (const slice of content) {
      file.write(slice)
    }
    const link = await file.close()
    fs.close()
    const blocks = await collector

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeieyaff3xepdv5r56bnhgxbxpjy6pzvxqpc6abjtkk4f46ylwop5ga"
      ),
      contentByteLength: chunkSize * leafCount,
      dagByteLength: 8411,
    })
  })

  it("write empty with defaults", async function () {
    const { readable, writable } = Channel.createBlockChannel()
    const fs = UnixFS.createWriter({ writable })
    const file = UnixFS.createFileWriter(fs)
    const collector = collect(readable)

    file.write(new Uint8Array())
    const link = await file.close()
    fs.close()
    const blocks = await collector

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeif7ztnhq65lumvvtr4ekcwd2ifwgm3awq4zfr3srh462rwyinlb4y"
      ),
      contentByteLength: 0,
      dagByteLength: 6,
    })
  })

  it("write backpressure", async function () {
    const { readable, writable } = Channel.createBlockChannel({
      highWaterMark: 16,
    })
    const fs = UnixFS.createWriter({ writable })
  })
})
