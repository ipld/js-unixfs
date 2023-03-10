import * as UnixFS from "../src/lib.js"
import { TransformStream } from "@web-std/stream"
import { assert } from "chai"
import { encodeUTF8, Link, collect, importFile } from "./util.js"

const createChannel = () => new TransformStream()
describe("test directory", () => {
  it("empty dir", async () => {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const root = UnixFS.createShardedDirectoryWriter({ writer })
    const link = await root.close()
    writer.close()

    assert.deepEqual(link, {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeifoplefg5piy3pjhlp73q7unqx4hwecxeu7opfqfmg352pkpljt6m"
      ),
      dagByteLength: 9,
    })
    const output = await collect(readable)

    assert.deepEqual(
      output.map($ => $.cid),
      [
        Link.parse(
          "bafybeifoplefg5piy3pjhlp73q7unqx4hwecxeu7opfqfmg352pkpljt6m"
        ),
      ]
    )
  })

  it("basic file in directory", async () => {
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const blocks = collect(readable)
    const root = UnixFS.createShardedDirectoryWriter({ writer })
    const file = UnixFS.createFileWriter(root)
    const content = encodeUTF8("this file does not have much content\n")
    file.write(content)
    const fileLink = await file.close()

    assert.deepEqual(fileLink, {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
      ),
      dagByteLength: 45,
      contentByteLength: 37,
    })

    root.set("file.txt", fileLink)
    const rootLink = await root.close()

    assert.deepEqual(rootLink, {
      dagByteLength: 133,
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeibbyshlpvztob4mtwznmnkzoc4upgcf6ghaulujxglzgmglcdubtm"
      ),
    })

    writer.close()

    const output = await blocks

    assert.deepEqual(
      output.map($ => $.cid),
      [
        Link.parse(
          "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
        ),
        Link.parse(
          "bafybeibbyshlpvztob4mtwznmnkzoc4upgcf6ghaulujxglzgmglcdubtm"
        ),
      ]
    )
  })

  it("nested directory", async () => {
    const { readable, writable } = new TransformStream()
    const blocks = collect(readable)
    const writer = writable.getWriter()
    const root = UnixFS.createShardedDirectoryWriter({ writer })
    const nested = UnixFS.createShardedDirectoryWriter(root)

    root.set("nested", await nested.close())
    assert.deepEqual(await root.close(), {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeiesoparpjbe5rwoo6liouikyw2nypo6v3d3n36vb334oddrmp52mq"
      ),
      dagByteLength: 102,
    })
    writer.close()

    const items = await blocks
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeifoplefg5piy3pjhlp73q7unqx4hwecxeu7opfqfmg352pkpljt6m",
        "bafybeiesoparpjbe5rwoo6liouikyw2nypo6v3d3n36vb334oddrmp52mq",
      ]
    )
  })

  it("double nested directory", async () => {
    const { readable, writable } = new TransformStream()
    const blocks = collect(readable)
    const writer = writable.getWriter()

    const root = UnixFS.createShardedDirectoryWriter({ writer })
    const nested = UnixFS.createShardedDirectoryWriter(root)

    root.set("nested", await nested.close())
    const main = UnixFS.createShardedDirectoryWriter({ writer })
    main.set("root", await root.close())
    const link = await main.close()
    writer.close()
    const items = await blocks
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeifoplefg5piy3pjhlp73q7unqx4hwecxeu7opfqfmg352pkpljt6m",
        "bafybeiesoparpjbe5rwoo6liouikyw2nypo6v3d3n36vb334oddrmp52mq",
        "bafybeifni4qs2xfgtzhk2xw7emp5j7h5ayyw73xizcba2qxry6dc4vqaom",
      ]
    )
  })

  it("throws if file already exists", async () => {
    const { readable, writable } = new TransformStream()
    const blocks = collect(readable)
    const writer = writable.getWriter()

    const root = UnixFS.createShardedDirectoryWriter({ writer })

    const hello = await importFile(root, ["hello"])
    assert.deepEqual(hello, {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
      ),
      contentByteLength: 5,
      dagByteLength: 13,
    })

    const bye = await importFile(root, ["bye"])
    assert.deepEqual(bye, {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
      ),
      dagByteLength: 11,
      contentByteLength: 3,
    })

    root.set("hello", hello)
    assert.throws(
      () => root.set("hello", bye),
      /Directory already contains entry with name "hello"/
    )
    root.set("bye", bye)
    const link = await root.close()

    assert.deepEqual(link, {
      /** @type {Link.Link} */
      cid: Link.parse(
        "bafybeihxagpxz7lekn7exw6ob526d6pgvnzc3kgtpkbh7ze73e2oc7oxpa"
      ),
      dagByteLength: 164,
    })
    writer.close()
    const items = await blocks
    assert.deepEqual(
      items.map(item => item.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
        "bafybeihxagpxz7lekn7exw6ob526d6pgvnzc3kgtpkbh7ze73e2oc7oxpa",
      ]
    )
  })

  // it("can overwrite existing", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const blocks = collect(readable)
  //   const writer = writable.getWriter()

  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   const hello = await importFile(root, ["hello"])
  //   assert.deepEqual(hello, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
  //     ),
  //     contentByteLength: 5,
  //     dagByteLength: 13,
  //   })

  //   const bye = await importFile(root, ["bye"])
  //   assert.deepEqual(bye, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
  //     ),
  //     dagByteLength: 11,
  //     contentByteLength: 3,
  //   })

  //   root.set("hello", hello)
  //   root.set("hello", bye, { overwrite: true })
  //   const link = await root.close()

  //   assert.deepEqual(link, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid6gy6b24lpyqtdmch7chsef4wykmxsh3ysuj2ou3wlz3cevdcc4a"
  //     ),
  //     dagByteLength: 64,
  //   })
  //   writer.close()
  //   const items = await blocks
  //   assert.deepEqual(
  //     items.map(item => item.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
  //       "bafybeid6gy6b24lpyqtdmch7chsef4wykmxsh3ysuj2ou3wlz3cevdcc4a",
  //     ]
  //   )
  // })

  // it("can delete entries", async () => {
  //   const { readable, writable } = createChannel()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   const hello = await importFile(root, ["hello"])
  //   assert.deepEqual(hello, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
  //     ),
  //     contentByteLength: 5,
  //     dagByteLength: 13,
  //   })

  //   root.set("hello", hello)
  //   root.remove("hello")
  //   const link = await root.close()

  //   assert.deepEqual(link, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354"
  //     ),
  //     dagByteLength: 4,
  //   })
  //   writer.close()
  //   const blocks = await reader
  //   assert.deepEqual(
  //     blocks.map(block => block.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
  //     ]
  //   )
  // })

  // it("throws on invalid filenames", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   const hello = await importFile(root, ["hello"])

  //   assert.throws(
  //     () => root.set("hello/world", hello),
  //     /Directory entry name "hello\/world" contains forbidden "\/" character/
  //   )
  //   writer.close()
  // })

  // it("can not change after close", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   const hello = await importFile(root, ["hello"])
  //   assert.deepEqual(hello, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
  //     ),
  //     contentByteLength: 5,
  //     dagByteLength: 13,
  //   })

  //   const bye = await importFile(root, ["bye"])
  //   assert.deepEqual(bye, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
  //     ),
  //     dagByteLength: 11,
  //     contentByteLength: 3,
  //   })

  //   root.set("hello", hello)
  //   assert.deepEqual(await root.close(), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
  //     ),
  //     dagByteLength: 66,
  //   })

  //   assert.throws(
  //     () => root.set("bye", bye),
  //     /Can not change written directory, but you can \.fork\(\) and make changes to it/
  //   )

  //   writer.close()
  //   const blocks = await reader
  //   assert.deepEqual(
  //     blocks.map(block => block.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
  //     ]
  //   )
  // })

  // it("can fork and edit", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   const hello = await importFile(root, ["hello"])
  //   assert.deepEqual(hello, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
  //     ),
  //     contentByteLength: 5,
  //     dagByteLength: 13,
  //   })

  //   const bye = await importFile(root, ["bye"])
  //   assert.deepEqual(bye, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
  //     ),
  //     dagByteLength: 11,
  //     contentByteLength: 3,
  //   })

  //   root.set("hello", hello)
  //   assert.deepEqual(await root.close(), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
  //     ),
  //     dagByteLength: 66,
  //   })

  //   const fork = root.fork()
  //   fork.set("bye", bye)
  //   assert.deepEqual(await fork.close(), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44"
  //     ),
  //     dagByteLength: 124,
  //   })

  //   writer.close()
  //   const blocks = await reader
  //   assert.deepEqual(
  //     blocks.map(block => block.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
  //       "bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44",
  //     ]
  //   )
  // })

  // it("can autoclose", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   const file = UnixFS.createFileWriter(root)
  //   file.write(new TextEncoder().encode("hello"))
  //   root.set("hello", await file.close())
  //   assert.deepEqual(await root.close({ closeWriter: true }), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
  //     ),
  //     dagByteLength: 66,
  //   })

  //   const blocks = await reader
  //   assert.deepEqual(
  //     blocks.map(block => block.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
  //     ]
  //   )
  // })

  // it("fork into other stream", async () => {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const reader = collect(readable)

  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   const hello = await importFile(root, ["hello"])
  //   assert.deepEqual(hello, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
  //     ),
  //     contentByteLength: 5,
  //     dagByteLength: 13,
  //   })

  //   const bye = await importFile(root, ["bye"])
  //   assert.deepEqual(bye, {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
  //     ),
  //     dagByteLength: 11,
  //     contentByteLength: 3,
  //   })

  //   root.set("hello", hello)
  //   assert.deepEqual(await root.close(), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq"
  //     ),
  //     dagByteLength: 66,
  //   })

  //   const patch = new TransformStream()
  //   const patchWriter = patch.writable.getWriter()
  //   const patchReader = collect(patch.readable)

  //   const fork = root.fork({ writer: patchWriter })
  //   fork.set("bye", bye)
  //   assert.deepEqual(await fork.close(), {
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44"
  //     ),
  //     dagByteLength: 124,
  //   })

  //   writer.close()
  //   const blocks = await reader
  //   assert.deepEqual(
  //     blocks.map(block => block.cid.toString()),
  //     [
  //       "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
  //       "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
  //       "bafybeieuo4clbaujw35wxt7s4jlorbgztvufvdrcxxb6hik5mzfqku2tbq",
  //     ]
  //   )

  //   patchWriter.close()
  //   const delta = await patchReader
  //   assert.deepEqual(
  //     delta.map(block => block.cid.toString()),
  //     ["bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44"]
  //   )
  // })

  // it("can close writer", async function () {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const blocks = collect(readable)
  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   const file = UnixFS.createFileWriter(root)

  //   file.write(encodeUTF8("this file does not have much content\n"))
  //   assert.equal(writable.locked, true)
  //   root.set("file.txt", await file.close())
  //   const link = await root.close({ releaseLock: true, closeWriter: true })

  //   await blocks

  //   assert.deepEqual(link, {
  //     dagByteLength: 101,
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeic7trkgurgp22uhxq5rnii5e75v4m4hf2ovohyxwntm4ymp7myh5i"
  //     ),
  //   })
  // })

  // it("can release writer lock", async function () {
  //   const { readable, writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const blocks = collect(readable)
  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   const file = UnixFS.createFileWriter(root)

  //   file.write(encodeUTF8("this file does not have much content\n"))
  //   assert.equal(writable.locked, true)
  //   root.set("file.txt", await file.close())
  //   const link = await root.close({ releaseLock: true })
  //   assert.equal(writable.locked, false)

  //   writable.close()
  //   await blocks

  //   assert.deepEqual(link, {
  //     dagByteLength: 101,
  //     /** @type {Link.Link} */
  //     cid: Link.parse(
  //       "bafybeic7trkgurgp22uhxq5rnii5e75v4m4hf2ovohyxwntm4ymp7myh5i"
  //     ),
  //   })
  // })

  // it("can enumerate entries", async function () {
  //   const { writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   assert.deepEqual([...root.entries()], [])
  //   /** @type {Link.Link} */
  //   const cid = Link.parse(
  //     "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
  //   )
  //   const fileLink = {
  //     cid,
  //     dagByteLength: 45,
  //     contentByteLength: 37,
  //   }

  //   root.set("file.txt", fileLink)
  //   assert.deepEqual([...root.entries()], [["file.txt", fileLink]])
  // })

  // it("can enumerate links", async function () {
  //   const { writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const root = UnixFS.createDirectoryWriter({ writer })

  //   assert.deepEqual([...root.links()], [])
  //   /** @type {Link.Link} */
  //   const cid = Link.parse(
  //     "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
  //   )
  //   const fileLink = {
  //     cid,
  //     dagByteLength: 45,
  //     contentByteLength: 37,
  //   }

  //   root.set("file.txt", fileLink)
  //   assert.deepEqual(
  //     [...root.links()],
  //     [
  //       {
  //         name: "file.txt",
  //         cid: fileLink.cid,
  //         dagByteLength: fileLink.dagByteLength,
  //       },
  //     ]
  //   )
  // })

  // it(".has", async function () {
  //   const { writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   assert.equal(root.has("file.txt"), false)
  //   /** @type {Link.Link} */
  //   const cid = Link.parse(
  //     "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
  //   )

  //   root.set("file.txt", {
  //     cid,
  //     dagByteLength: 45,
  //     contentByteLength: 37,
  //   })
  //   assert.equal(root.has("file.txt"), true)

  //   root.remove("file.txt")
  //   assert.equal(root.has("file.txt"), false)
  // })

  // it(".size", async function () {
  //   const { writable } = new TransformStream()
  //   const writer = writable.getWriter()
  //   const root = UnixFS.createDirectoryWriter({ writer })
  //   assert.equal(root.size, 0)
  //   /** @type {Link.Link} */
  //   const cid = Link.parse(
  //     "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
  //   )

  //   root.set("file.txt", {
  //     cid,
  //     dagByteLength: 45,
  //     contentByteLength: 37,
  //   })
  //   assert.equal(root.size, 1)

  //   root.remove("file.txt")
  //   assert.equal(root.size, 0)
  // })
})
