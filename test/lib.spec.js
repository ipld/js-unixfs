import * as UnixFS from "../src/lib.js"
import { assert } from "chai"
import { encodeUTF8, Link, collect, importFile } from "./util.js"
import { TransformStream } from "@web-std/stream"

describe("UnixFS.createWriter", () => {
  it("UnixFS.createFileWriter", async () => {
    const { readable, writable } = new TransformStream()
    const reader = collect(readable)
    const writer = UnixFS.createWriter({ writable })
    const file = UnixFS.createFileWriter(writer)
    file.write(new TextEncoder().encode("hello world"))
    assert.deepEqual(await file.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })
    writer.close()

    const blocks = await reader
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("fs.createFileWriter", async () => {
    const { readable, writable } = new TransformStream()
    const reader = collect(readable)
    const writer = UnixFS.createWriter({ writable })
    const file = writer.createFileWriter()
    file.write(encodeUTF8("hello world"))
    assert.deepEqual(await file.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
      ),
      dagByteLength: 19,
      contentByteLength: 11,
    })

    writer.close()

    const blocks = await reader
    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      ["bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"]
    )
  })

  it("UnixFS.createDirectoryWriter", async () => {
    const { readable, writable } = new TransformStream()
    const reader = collect(readable)
    const writer = UnixFS.createWriter({ writable })
    const root = UnixFS.createDirectoryWriter(writer)

    root.set("hello", await importFile(root, ["hello"]))
    assert.deepEqual(await root.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
      ),
      dagByteLength: 66,
    })
    writer.close()

    const blocks = await reader

    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
      ]
    )
  })

  it("fs.createDirectoryWriter", async () => {
    const { readable, writable } = new TransformStream()
    const reader = collect(readable)
    const writer = UnixFS.createWriter({ writable })
    const root = writer.createDirectoryWriter()

    root.set("hello", await importFile(root, ["hello"]))
    assert.deepEqual(await root.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
      ),
      dagByteLength: 66,
    })
    writer.close()

    const blocks = await reader

    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
      ]
    )
  })

  it("can release lock", async () => {
    const { readable, writable } = new TransformStream()
    const reader = collect(readable)
    const writer = UnixFS.createWriter({ writable })
    const root = UnixFS.createDirectoryWriter(writer)

    root.set("hello", await importFile(root, ["hello"]))
    assert.deepEqual(await root.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
      ),
      dagByteLength: 66,
    })
    writer.close({ closeWriter: false })
    assert.equal(writable.locked, false)

    const wr = writable.getWriter()
    assert.equal(writable.locked, true)

    wr.close()

    const blocks = await reader

    assert.deepEqual(
      blocks.map($ => $.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
      ]
    )
  })
})

describe("UnixFS.withCapacity", async () => {
  const { readable, writable } = new TransformStream(
    {},
    UnixFS.withCapacity(128)
  )

  const fs = UnixFS.createWriter({ writable })
  const file = UnixFS.createFileWriter(fs)
  file.write(new TextEncoder().encode("hello world"))
  assert.deepEqual(await file.close(), {
    /** @type {Link.Link} */
    cid: Link.parse(
      "bafybeihykld7uyxzogax6vgyvag42y7464eywpf55gxi5qpoisibh3c5wa"
    ),
    dagByteLength: 19,
    contentByteLength: 11,
  })

  assert.equal(fs.writer.desiredSize, 128 - 19)

  const bye = UnixFS.createFileWriter(fs)
  bye.write(new TextEncoder().encode("bye"))

  assert.deepEqual(await bye.close(), {
    /** @type {Link.Link} */
    cid: Link.parse(
      "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
    ),
    dagByteLength: 11,
    contentByteLength: 3,
  })

  assert.equal(fs.writer.desiredSize, 128 - 19 - 11)
  fs.close()
})
