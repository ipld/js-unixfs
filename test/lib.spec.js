// @ts-nocheck
/* eslint-env mocha */
import * as PB from "@ipld/dag-pb"
// import { UnixFS } from "ipfs-unixfs"
// import { fromString as utf8Encode } from "uint8arrays/from-string"
import * as fs from "fs"
import * as unixfs from "../src/lib.js"
import { expect, assert } from "chai"
import * as blocks from "./fixtures.js"

// const fixtures = new URL("../../../ipfs-unixfs/test/fixtures/", import.meta.url)

const utf8 = new TextEncoder()
const MURMUR = 0x22

/**
 * @param {string} text
 */
const utf8Encode = text => utf8.encode(text)

describe("unixfs-format", () => {
  it("encodes simple file", () => {
    const block = unixfs.encode({
      layout: "simple",
      type: unixfs.NodeType.File,
      content: utf8.encode("batata"),
    })

    const node = unixfs.decode(block)
    if (node.type != unixfs.NodeType.File) assert.fail("expected file type")

    if (node.layout !== "simple") assert.fail("expected simple layout")

    assert.equal(unixfs.filesize(node), 6)
    assert.deepEqual(node.content, utf8.encode("batata"))
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
    // @ts-expect-error - filesize does not take dir
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
    // @ts-expect-error - filesize does not take dir
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
    if (node.type !== unixfs.NodeType.File) assert.fail("expect file")
    node
    if (node.layout !== "simple") assert.fail("expect simple")
    assert.deepEqual(node.metadata, { mode })

    expect().to.deep.equal({
      type: unixfs.NodeType.File,
      kind: "simple",
      mode,
      filesize: 4,
      content: utf8Encode("mode"),
    })
  })

  it("omits default file mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      mode: parseInt("0644", 8),
      content: utf8Encode("0644"),
    })

    expect(unixfs.decode(block)).to.deep.equal({
      kind: "simple",
      type: unixfs.NodeType.File,
      filesize: 4,
      content: utf8Encode("0644"),
    })
  })

  it("dir mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,
      mode: parseInt("0775", 8),
      entries: [],
    })

    expect(unixfs.decode(block)).to.deep.equal({
      type: unixfs.NodeType.Directory,
      mode: parseInt("0775", 8),
      entries: [],
    })
  })

  it("omits default dir mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Directory,
      mode: parseInt("0755", 8),
      entries: [],
    })

    expect(unixfs.decode(block)).to.deep.equal({
      type: unixfs.NodeType.Directory,
      entries: [],
    })
  })

  it("hamt mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.HAMTShard,
      mode: parseInt("0775", 8),
      bitfield: new Uint8Array(),
      fanout: 16,
      hashType: MURMUR,
      entries: [],
    })

    expect(unixfs.decode(block)).to.deep.equal({
      type: unixfs.NodeType.HAMTShard,
      mode: parseInt("0775", 8),
      fanout: 16,
      hashType: MURMUR,
      entries: [],
    })
  })

  it("omits default hamt mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.HAMTShard,
      mode: parseInt("0755", 8),
      bitfield: new Uint8Array(),
      fanout: 128,
      hashType: MURMUR,
      entries: [],
    })

    expect(unixfs.decode(block)).to.deep.equal({
      type: unixfs.NodeType.HAMTShard,
      fanout: 128,
      hashType: MURMUR,
      entries: [],
    })
  })

  it("mtime", () => {
    const mtime = {
      secs: 5,
      nsecs: 0,
    }
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      mtime,
      content: utf8Encode("mtime"),
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.File,
      kind: "simple",
      mtime: { secs: 5, nsecs: 0 },
      content: utf8Encode("mtime"),
      filesize: 5,
    })
  })

  it("mtime without nsecs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      mtime: { secs: 5 },
      content: utf8Encode("mtime"),
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.File,
      kind: "simple",
      mtime: { secs: 5, nsecs: 0 },
      content: utf8Encode("mtime"),
      filesize: 5,
    })
  })

  it("does not overwrite unknown mode bits", () => {
    const mode = 0xfffffff // larger than currently defined mode bits

    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      content: utf8Encode("bits"),
      mode,
    })

    expect(unixfs.decode(block)).to.deep.equal({
      type: unixfs.NodeType.File,
      kind: "simple",
      mode,
      filesize: 4,
      content: utf8Encode("bits"),
    })
  })

  it("empty", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      content: new Uint8Array(),
    })

    expect(block.slice(2)).to.deep.equal(
      Uint8Array.from([0x08, 0x02, 0x18, 0x00])
    )
  })

  it("symlink", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
    })
  })

  it("symlink may have mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mode: parseInt("0664", 8),
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mode: parseInt("0664", 8),
    })
  })

  it("symlink omit default mode", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mode: parseInt("0644", 8),
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
    })
  })

  it("symlink with mtime.secs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mtime: {
        secs: 5,
      },
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mtime: {
        secs: 5,
        nsecs: 0,
      },
    })
  })

  it("symlink with mtime.nsecs", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mtime: {
        secs: 5,
        nsecs: 7,
      },
    })

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: unixfs.NodeType.Symlink,
      content: utf8Encode("file.txt"),
      mtime: {
        secs: 5,
        nsecs: 7,
      },
    })
  })
})

describe.skip("interop", () => {
  it("raw", () => {
    const block = unixfs.encode({
      type: unixfs.NodeType.File,
      content: utf8Encode("Hello UnixFS\n"),
    })

    expect(block.slice(2)).to.deep.equal(
      new Uint8Array(fs.readFileSync(new URL("raw.unixfs", fixtures)))
    )
  })

  it("directory", () => {
    const block = unixfs.encode({
      type: "Directory",
      links: [],
    })

    expect(block.slice(2)).to.deep.equal(
      new Uint8Array(fs.readFileSync(new URL("directory.unixfs", fixtures)))
    )
  })

  it("file", () => {
    const block = unixfs.encode({
      type: "File",
      content: utf8Encode("Hello UnixFS\n"),
    })

    expect(block.slice(2)).to.deep.equal(
      new Uint8Array(fs.readFileSync(new URL("file.txt.unixfs", fixtures)))
    )
  })

  it("symlink", () => {
    const block = unixfs.encode({
      type: "Symlink",
      content: utf8Encode("file.txt"),
    })

    const symlink = fs.readFileSync(new URL("symlink.txt.unixfs", fixtures))
    expect(block.slice(2)).to.deep.equal(new Uint8Array(symlink))

    expect(unixfs.decode(block)).to.be.deep.equal({
      type: "Symlink",
      content: utf8Encode("file.txt"),
    })
  })
})

describe("format neunaces", () => {
  it("raw with no content", () => {
    const bytes = unixfs.encode(unixfs.createRaw(new Uint8Array()))
    assert.deepEqual(
      bytes,
      blocks.Qmdsf68UUYTSSx3i4GtDJfxzpAEZt7Mp23m3qa36LYMSiW
    )
  })

  it("file with no content", () => {
    const bytes = unixfs.encodeSimpleFile(new Uint8Array())
    assert.deepEqual(
      bytes,
      blocks.QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH
    )
  })

  it("emty flat dir", () => {
    const bytes = unixfs.encode(unixfs.createFlatDirectory([]))
    assert.deepEqual(
      bytes,
      blocks.QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn
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
      unixfs.createShardedDirectory([], new Uint8Array(), 256, 0x22)
    )

    assert.deepEqual(
      bytes,
      blocks.Qma5kEnM5fEKTXrFC5zXYRy5QG3hcMWopoFS7ijhxx19qc
    )
  })

  it("symlink", () => {
    const bytes = unixfs.encode(unixfs.createSymlink(utf8.encode("hi")))
    assert.deepEqual(
      bytes,
      blocks.QmPZ1CTc5fYErTH2XXDGrfsPsHicYXtkZeVojGycwAfm3v
    )
  })
})
