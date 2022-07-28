import * as UnixFS from "../src/lib.js"
import { assert } from "chai"
import { encodeUTF8, CID, collect, importFile } from "./util.js"

describe("UnixFS", () => {
  it("UnixFS.createWriter", async () => {
    const { readable, writable } = UnixFS.create()
    const fs = UnixFS.createWriter({ writable })
    assert.deepEqual(await importFile(fs, ["hello world"]), {
      cid: CID.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })
    await fs.close()

    const blocks = await collect(readable)
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("UnixFS.createFile", async () => {
    const file = UnixFS.createFile()
    file.write(encodeUTF8("hello world"))
    assert.deepEqual(await file.close(), {
      cid: CID.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })

    const blocks = await collect(file.readable)
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("UnixFS.createDirectory", async () => {
    const root = UnixFS.createDirectory()

    root.write("hello", await importFile(root, ["hello"]))
    assert.deepEqual(await root.close(), {
      cid: CID.parse(
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
      ),
      dagByteLength: 66,
    })

    const blocks = await collect(root.readable)

    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
      ]
    )
  })
})
