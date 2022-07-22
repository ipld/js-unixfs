import * as UnixFS from "../src/lib.js"
import { assert } from "chai"
import { encodeUTF8, CID, collect, importFile } from "./util.js"

describe("test directory", () => {
  it("empty dir", async () => {
    const fs = UnixFS.create()
    const root = UnixFS.createDirectoryWriter(fs)
    const link = await root.close()
    fs.close()

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354"
      ),
      dagByteLength: 4,
    })
    const output = await collect(fs.readable)

    assert.deepEqual(
      output.map($ => $.cid),
      [CID.parse("bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354")]
    )
  })

  it("basic file in directory", async () => {
    const fs = UnixFS.create()
    const root = UnixFS.createDirectoryWriter(fs)
    const file = UnixFS.createFileWriter(fs)
    const content = encodeUTF8("this file does not have much content\n")
    file.write(content)
    const fileLink = await file.close()

    assert.deepEqual(fileLink, {
      cid: CID.parse(
        "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
      ),
      dagByteLength: 45,
      contentByteLength: 37,
    })

    root.write("file.txt", fileLink)
    const rootLink = await root.close()

    assert.deepEqual(rootLink, {
      dagByteLength: 101,
      cid: CID.parse(
        "bafybeic7trkgurgp22uhxq5rnii5e75v4m4hf2ovohyxwntm4ymp7myh5i"
      ),
    })

    fs.close()

    const output = await collect(fs.readable)

    assert.deepEqual(
      output.map($ => $.cid),
      [
        CID.parse(
          "bafybeidequ5soq6smzafv4lb76i5dkvl5fzgvrxz4bmlc2k4dkikklv2j4"
        ),
        CID.parse(
          "bafybeic7trkgurgp22uhxq5rnii5e75v4m4hf2ovohyxwntm4ymp7myh5i"
        ),
      ]
    )
  })

  it("nested directory", async () => {
    const fs = UnixFS.create()
    const root = UnixFS.createDirectoryWriter(fs)
    const nested = UnixFS.createDirectoryWriter(fs)

    root.write("nested", await nested.close())
    assert.deepEqual(await root.close(), {
      cid: CID.parse(
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q"
      ),
      dagByteLength: 58,
    })
    await fs.close()
    const items = await collect(fs.readable)
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q",
      ]
    )
  })

  it("double nested directory", async () => {
    const fs = UnixFS.create()
    const root = UnixFS.createDirectoryWriter(fs)
    const nested = UnixFS.createDirectoryWriter(fs)

    root.write("nested", await nested.close())
    const main = UnixFS.createDirectoryWriter(fs)
    main.write("root", await root.close())
    const link = await main.close()
    await fs.close()
    const items = await collect(fs.readable)
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q",
        "bafybeifr5xx3ihkbvvodn6xgejnkeuzyak3pwgrbqahb2afazqfes6opla",
      ]
    )
  })

  it("throws if file already exists", async () => {
    const fs = UnixFS.create()

    const root = UnixFS.createDirectoryWriter(fs)

    const hello = await importFile(fs, ["hello"])
    assert.deepEqual(hello, {
      cid: CID.parse(
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
      ),
      contentByteLength: 5,
      dagByteLength: 13,
    })

    const bye = await importFile(fs, ["bye"])
    assert.deepEqual(bye, {
      cid: CID.parse(
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
      ),
      dagByteLength: 11,
      contentByteLength: 3,
    })

    root.write("hello", hello)
    assert.throws(
      () => root.write("hello", bye),
      /Diretroy already contains entry with name "hello"/
    )
    root.write("bye", bye)
    const link = await root.close()

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44"
      ),
      dagByteLength: 124,
    })
    await fs.close()
    const items = await collect(fs.readable)
    assert.deepEqual(
      items.map(item => item.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
        "bafybeibpefc2sgzngxttfwrawvaiewk4hj5yxdp5kik52jpds5ujg3ij44",
      ]
    )
  })

  it("can overwrite existing", async () => {
    const fs = UnixFS.create()

    const root = UnixFS.createDirectoryWriter(fs)

    const hello = await importFile(fs, ["hello"])
    assert.deepEqual(hello, {
      cid: CID.parse(
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
      ),
      contentByteLength: 5,
      dagByteLength: 13,
    })

    const bye = await importFile(fs, ["bye"])
    assert.deepEqual(bye, {
      cid: CID.parse(
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta"
      ),
      dagByteLength: 11,
      contentByteLength: 3,
    })

    root.write("hello", hello)
    root.write("hello", bye, { overwrite: true })
    const link = await root.close()

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeid6gy6b24lpyqtdmch7chsef4wykmxsh3ysuj2ou3wlz3cevdcc4a"
      ),
      dagByteLength: 64,
    })
    await fs.close()
    const items = await collect(fs.readable)
    assert.deepEqual(
      items.map(item => item.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeigl43jff4muiw2m6kzqhm7xpz6ti7etiujklpnc6vpblzjvvwqmta",
        "bafybeid6gy6b24lpyqtdmch7chsef4wykmxsh3ysuj2ou3wlz3cevdcc4a",
      ]
    )
  })

  it("can delete entries", async () => {
    const fs = UnixFS.create()

    const root = UnixFS.createDirectoryWriter(fs)

    const hello = await importFile(fs, ["hello"])
    assert.deepEqual(hello, {
      cid: CID.parse(
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq"
      ),
      contentByteLength: 5,
      dagByteLength: 13,
    })

    root.write("hello", hello)
    root.remove("hello")
    const link = await root.close()

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354"
      ),
      dagByteLength: 4,
    })
    await fs.close()
    const items = await collect(fs.readable)
    assert.deepEqual(
      items.map(item => item.cid.toString()),
      [
        "bafybeid3weurg3gvyoi7nisadzolomlvoxoppe2sesktnpvdve3256n5tq",
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
      ]
    )
  })
})
