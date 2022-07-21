import * as UnixFS from "@ipld/unixfs"
import * as Rabin from "@ipld/unixfs/src/file/chunker/rabin.js"
import * as Fixed from "@ipld/unixfs/src/file/chunker/fixed.js"
import * as Balanced from "@ipld/unixfs/src/file/layout/balanced.js"
import * as Trickle from "@ipld/unixfs/src/file/layout/trickle.js"

export const test = async () => {
  UnixFS.encode({
    type: UnixFS.NodeType.File,
    layout: "simple",
    content: new Uint8Array(32).fill(1),
  })

  const { blocks, writer } = UnixFS.create()
  const file = writer.createFileWriter()
  file.write(new Uint8Array(32).fill(1))
  const link = await file.close()
  link.cid.toString()

  writer.close()
}
