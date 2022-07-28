import * as UnixFS from "../src/lib.js"
import { assert } from "chai"
import { encodeUTF8, CID, collect, importFile } from "./util.js"
import { TransformStream } from "@web-std/stream"

describe("UnixFS", () => {
  it("UnixFS.createWriter", async () => {
    const { readable, writable } = new TransformStream()
    const fs = UnixFS.createWriter({ writable })
    assert.deepEqual(await importFile(fs, ["hello world"]), {
      cid: CID.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })
    fs.close()

    const blocks = await collect(readable)
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("UnixFS.createFileWriter", async () => {
    const { readable, writable } = new TransformStream()
    const file = UnixFS.createFileWriter({ writable, releaseLock: true })
    file.write(encodeUTF8("hello world"))
    assert.deepEqual(await file.close(), {
      cid: CID.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })

    writable.close()

    const blocks = await collect(readable)
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("UnixFS.createDirectoryWriter", async () => {
    const { readable, writable } = new TransformStream(
      {},
      {},
      {
        highWaterMark: 2,
      }
    )
    const root = UnixFS.createDirectoryWriter({ writable, releaseLock: true })

    root.write("hello", await importFile(root, ["hello"]))
    assert.deepEqual(await root.close(), {
      cid: CID.parse(
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
      ),
      dagByteLength: 66,
    })
    writable.close()

    const blocks = await collect(readable)

    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
      ]
    )
  })
})
