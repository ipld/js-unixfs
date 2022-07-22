import * as UnixFS from "../src/lib.js"
import { assert } from "chai"
import { encodeUTF8, CID, collect } from "./util.js"

describe.only("test directory", () => {
  it("empty dir", async () => {
    const { blocks, writer } = UnixFS.create()
    const root = writer.createDirectoryWriter()
    const link = await root.close()
    writer.close()

    assert.deepEqual(link, {
      cid: CID.parse(
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354"
      ),
      dagByteLength: 4,
    })
    const output = await collect(blocks)

    assert.deepEqual(
      output.map($ => $.cid),
      [CID.parse("bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354")]
    )
  })

  it("basic file in directory", async () => {
    const { blocks, writer } = UnixFS.create()
    const root = writer.createDirectoryWriter()
    const file = writer.createFileWriter()
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

    writer.close()

    const output = await collect(blocks)

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
    const { blocks, writer } = UnixFS.create()
    const root = writer.createDirectoryWriter()
    const nested = writer.createDirectoryWriter()

    root.write("nested", await nested.close())
    assert.deepEqual(await root.close(), {
      cid: CID.parse(
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q"
      ),
      dagByteLength: 58,
    })
    await writer.close()
    const items = await collect(blocks)
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q",
      ]
    )
  })

  it("double nested directory", async () => {
    const { blocks, writer } = UnixFS.create()
    const root = writer.createDirectoryWriter()
    const nested = writer.createDirectoryWriter()

    root.write("nested", await nested.close())
    const main = writer.createDirectoryWriter()
    main.write("root", await root.close())
    const link = await main.close()
    await writer.close()
    const items = await collect(blocks)
    assert.deepEqual(
      items.map(({ cid }) => cid.toString()),
      [
        "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
        "bafybeibjme43s5mbvupa25dl3xpbkmuqeje7hefvavy6k7cuhm3nxz2m3q",
        "bafybeifr5xx3ihkbvvodn6xgejnkeuzyak3pwgrbqahb2afazqfes6opla",
      ]
    )
  })
})
