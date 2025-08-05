/* eslint-env mocha */
import * as unixfs from "../src/codec.js"
import { assert } from "chai"
import * as blocks from "./fixtures.js"
import { describe, it } from "mocha"

import * as Block from "multiformats/block"
import { sha256 } from "multiformats/hashes/sha2"
import * as dagCbor from "@ipld/dag-cbor"

const utf8 = new TextEncoder()
const MURMUR = 0x22

/**
 * @param {string} text
 */
const utf8Encode = (text) => utf8.encode(text)

/**
 * @param {import("src/unixfs.js").BlockView<unknown, 113, 18, 1>} block
 * @param {Uint8Array} content
 * @returns {unixfs.FileLink}
 */
const createLink = (block, content) => ({
  cid: block.cid,
  contentByteLength: content.byteLength,
  dagByteLength: block.bytes.byteLength,
})

describe("unixfs-format", () => {
  describe("file", () => {
    it("simple", () => {
      const block = unixfs.encode({
        layout: "simple",
        type: unixfs.NodeType.File,
        content: utf8.encode("batata"),
      })

      const node = unixfs.decode(block)

      // @ts-expect-error - can't pass a generic to `unixfs.encode` to narrow the type
      assert.equal(node.filesize, 6)

      assert.deepEqual(node, {
        type: unixfs.NodeType.File,
        layout: "simple",
        metadata: {},
        content: utf8.encode("batata"),
      })

      assert.equal(unixfs.filesize(node), 6)
    })

    it("complex", async () => {
      const content = utf8.encode("Hello UnixFS\n")

      const fileShardBlock = await Block.encode({
        value: unixfs.encode({
          layout: "simple",
          type: unixfs.NodeType.Raw,
          content,
        }),
        codec: dagCbor,
        hasher: sha256,
      })
      const fileLink = createLink(fileShardBlock, content)
      const complexNode = unixfs.encode({
        layout: "complex",
        type: unixfs.NodeType.File,
        parts: [fileLink],
        content,
      })

      /**
       * @type {any}
       */
      const node = unixfs.decode(complexNode)

      assert.deepEqual(
        node.fileSize,
        content.byteLength + fileLink.contentByteLength,
      )
      assert.deepEqual(node.blockSizes, [BigInt(fileLink.contentByteLength)])

      assert.deepEqual((/** @type {unixfs.ComplexFile} */ (node)).parts, [
        fileLink,
      ])
      assert.deepEqual(
        (/** @type {unixfs.ComplexFile} */ (node)).content,
        utf8.encode("Hello UnixFS\n"),
      )
      assert.equal(
        unixfs.filesize(node),
        content.byteLength + fileLink.contentByteLength,
      )
    })

    it("advanced", async () => {
      const content = utf8.encode("Hello UnixFS\n")

      const fileShardBlock = await Block.encode({
        value: unixfs.encode({
          layout: "simple",
          type: unixfs.NodeType.Raw,
          content,
        }),
        codec: dagCbor,
        hasher: sha256,
      })

      const fileLink = createLink(fileShardBlock, content)

      const complexNode = unixfs.encode({
        layout: "advanced",
        type: unixfs.NodeType.File,
        parts: [fileLink],
      })

      /**
       * @type {any}
       */
      const node = unixfs.decode(complexNode)

      assert.deepEqual(node.fileSize, content.byteLength)
      assert.deepEqual(node.blockSizes, [BigInt(fileLink.contentByteLength)])

      assert.deepEqual((/** @type {unixfs.AdvancedFile} */ (node)).parts, [
        fileLink,
      ])
      assert.equal(
        unixfs.filesize(node),
        fileLink.contentByteLength,
      )
    })
  })

  it("raw", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Raw,
      content: utf8Encode("bananas"),
    })

    const node = unixfs.decode(block)

    if (node.type != unixfs.NodeType.Raw) assert.fail("expected raw")
    assert.deepEqual(node.content, utf8Encode("bananas"))
    assert.equal(unixfs.filesize(node), 7)
  })

  it("directory", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,
      entries: [],
      metadata: {},
    })

    const node = unixfs.decode(block)
    if (node.type != unixfs.NodeType.Directory) assert.fail("expected dir")
    assert.deepEqual(node.entries, [])
    assert.equal(unixfs.filesize(node), 0)
  })

  it("hamt-sharded-directory", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.HAMTShard,
      bitfield: new Uint8Array(),
      fanout: 8,
      hashType: MURMUR,
      entries: [],
    })

    const node = unixfs.decode(block)

    if (node.type != unixfs.NodeType.HAMTShard) assert.fail("expected HAMT")
    assert.equal(node.fanout, 8)
    assert.equal(node.hashType, MURMUR)
    assert.deepEqual(node.entries, [])
    assert.deepEqual(node.bitfield, new Uint8Array())
    assert.equal(unixfs.filesize(node), 0)
  })

  it("mode", () => {
    const mode = parseInt("0555", 8)
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mode },
      content: utf8Encode("mode"),
    })

    const node = unixfs.decode(block)
    assert.deepEqual(node, {
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mode },
      content: utf8Encode("mode"),
    })
  })

  it("omits default file mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mode: parseInt("0644", 8) },
      content: utf8Encode("0644"),
    })

    assert.deepEqual(unixfs.decode(block), {
      layout: "simple",
      metadata: {},
      type: unixfs.NodeType.File,
      content: utf8Encode("0644"),
    })
  })

  it("dir mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,
      metadata: { mode: parseInt("0775", 8) },
      entries: [],
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Directory,
      metadata: { mode: parseInt("0775", 8) },
      entries: [],
    })
  })

  it("omits default dir mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,
      metadata: { mode: parseInt("0755", 8) },
      entries: [],
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Directory,
      metadata: {},
      entries: [],
    })
  })

  it("hamt mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.HAMTShard,
      metadata: { mode: parseInt("0775", 8) },
      bitfield: new Uint8Array(),
      fanout: 16,
      hashType: MURMUR,
      entries: [],
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.HAMTShard,
      bitfield: new Uint8Array(),
      metadata: { mode: parseInt("0775", 8) },
      fanout: 16,
      hashType: MURMUR,
      entries: [],
    })
  })

  it("omits default hamt mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.HAMTShard,
      metadata: { mode: parseInt("0755", 8) },
      bitfield: new Uint8Array(),
      fanout: 128,
      hashType: MURMUR,
      entries: [],
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.HAMTShard,
      bitfield: new Uint8Array(),
      fanout: 128,
      hashType: MURMUR,
      entries: [],
      metadata: {},
    })
  })

  it("mtime", () => {
    const mtime = {
      secs: 5n,
      nsecs: 0,
    }
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mtime },
      content: utf8Encode("mtime"),
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mtime: { secs: 5n, nsecs: 0 } },
      content: utf8Encode("mtime"),
    })
  })

  it("mtime without nsecs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mtime: { secs: 5n } },
      content: utf8Encode("mtime"),
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mtime: { secs: 5n, nsecs: 0 } },
      content: utf8Encode("mtime"),
    })
  })

  it("does not overwrite unknown mode bits", () => {
    const mode = 0xfffffff // larger than currently defined mode bits

    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      content: utf8Encode("bits"),
      metadata: { mode },
    })

    const node = /** @type {unixfs.File} */ (unixfs.decode(block))

    assert.deepEqual(node, {
      type: unixfs.NodeType.File,
      layout: "simple",
      metadata: { mode },
      content: utf8Encode("bits"),
    })
  })

  it("empty", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      content: new Uint8Array(),
    })

    assert.deepEqual(block.slice(2), Uint8Array.from([0x08, 0x02, 0x18, 0x00]))
  })

  it("symlink", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {},
    })
  })

  it("symlink may have mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mode: parseInt("0664", 8),
      },
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mode: parseInt("0664", 8),
      },
    })
  })

  it("symlink omit default mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mode: parseInt("0644", 8),
      },
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {},
    })
  })

  it("symlink with mtime.secs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mtime: {
          secs: 5n,
        },
      },
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mtime: {
          secs: 5n,
          nsecs: 0,
        },
      },
    })
  })

  it("symlink with mtime.nsecs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mtime: {
          secs: 5n,
          nsecs: 7,
        },
      },
    })

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {
        mtime: {
          secs: 5n,
          nsecs: 7,
        },
      },
    })
  })
  it("throws on invalid node type", () => {
    assert.throws(() => {
      unixfs.encode({
        type: /** @type {any} */ ("blah"),
        content: utf8Encode("Hello UnixFS\n"),
      })
    }, /Unknown node type blah/)
    assert.throws(() => {
      unixfs.decode(Buffer.from(unixfs.encode({
        type: /** @type {any} */ ("blah"),
        content: utf8Encode("Hello UnixFS\n"),
      })))
    })
  })
  it("throws on invalid layout", () => {
    assert.throws(() => {
      unixfs.encode({
        type: unixfs.NodeType.File,
        layout: /** @type {any} */ ("blah"),
        content: utf8Encode("Hello UnixFS\n"),
      })
    })
  })
})

describe.skip("interop", () => {
  it("raw", async () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      content: utf8Encode("Hello UnixFS\n"),
    })

    const fixture = await fetch("./fixtures/utilraw.unixfs")

    assert.deepEqual(
      block.slice(2),
      new Uint8Array(await fixture.arrayBuffer()),
    )
  })

  it("directory", async () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,

      entries: [],
    })

    const fixture = await fetch("./fixtures/directory.unixfs")

    assert.deepEqual(
      block.slice(2),
      new Uint8Array(await fixture.arrayBuffer()),
    )
  })

  it("file", async () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      layout: "simple",
      content: utf8Encode("Hello UnixFS\n"),
    })

    const fixture = await fetch("./fixtures/file.txt.unixfs")

    assert.deepEqual(
      block.slice(2),
      new Uint8Array(await fixture.arrayBuffer()),
    )
  })

  it("symlink", async () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
    })

    const fixture = await fetch("./fixtures/symlink.txt.unixfs")

    assert.deepEqual(
      block.slice(2),
      new Uint8Array(await fixture.arrayBuffer()),
    )

    assert.deepEqual(unixfs.decode(block), {
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      metadata: {},
    })
  })
})

describe("format neunaces", () => {
  it("raw with no content", () => {
    const bytes = unixfs.encode(unixfs.createRaw(new Uint8Array()))
    assert.deepEqual(
      bytes,
      blocks.Qmdsf68UUYTSSx3i4GtDJfxzpAEZt7Mp23m3qa36LYMSiW,
    )
  })

  it("file with no content", () => {
    const bytes = unixfs.encodeSimpleFile(new Uint8Array())
    assert.deepEqual(
      bytes,
      blocks.QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH,
    )
  })

  it("emty flat dir", () => {
    const bytes = unixfs.encode(unixfs.createFlatDirectory([]))
    assert.deepEqual(
      bytes,
      blocks.QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn,
    )
  })

  it("empty sharded dir", () => {
    assert.throws(() => {
      unixfs.createShardedDirectory([], new Uint8Array(), 3, 0x22)
    }, /power of two instead got 3/)

    assert.throws(() => {
      unixfs.createShardedDirectory([], new Uint8Array(), 16, 0.2)
    }, /integer value instead got 0.2/)

    // note if you create a block like /ipfs/Qme1Cyu7ujqn3dRkRGmeTLpHJgbGHFjKmud48XK5W8qA6h
    // go-ipfs will say only murmur3 supported as hash function

    const bytes = unixfs.encode(
      unixfs.createShardedDirectory([], new Uint8Array(), 256, 0x22),
    )

    assert.deepEqual(
      bytes,
      blocks.Qma5kEnM5fEKTXrFC5zXYRy5QG3hcMWopoFS7ijhxx19qc,
    )
  })

  it("symlink", () => {
    const bytes = unixfs.encode(unixfs.createSymlink(utf8.encode("hi")))
    assert.deepEqual(
      bytes,
      blocks.QmPZ1CTc5fYErTH2XXDGrfsPsHicYXtkZeVojGycwAfm3v,
    )
  })
})
