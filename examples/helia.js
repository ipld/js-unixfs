import * as UnixFS from '@ipld/unixfs'
import * as raw from 'multiformats/codecs/raw'

/**
 * Usage:
 * 
 * ```js
 * const helia = await createHelia()
 * await demo(helia)
 * ```
 */
export const demo = async helia => {
  const { readable, writable } = new TransformStream()

  // Encode a UnixFS directory of files, writing them to the `writable` side of
  // the transform stream.
  const encodeDirectory = async () => {
    // Create a writer with filesystem like API for encoding files and
    // directories into IPLD blocks.
    const writer = UnixFS.createWriter({
      writable,
      settings: UnixFS.configure({ fileChunkEncoder: raw, smallFileEncoder: raw })
    })

    const file = UnixFS.createFileWriter(writer)
    file.write(new TextEncoder().encode('hello world'))
    const fileLink = await file.close()

    // Create directory and add the file we encoded above.
    const dir = UnixFS.createDirectoryWriter(writer)
    dir.set('hello.txt', fileLink)
    const dirLink = await dir.close()

    await writer.close()
    return dirLink
  }

  // Read the blocks created by the UnixFS encoder from the `readable` side of
  // the transform stream.
  const writeBlocks = () => readable.pipeTo(new WritableStream({
    async write (block) {
      await helia.blockstore.put(block.cid, block.bytes)
    }
  }))

  // Wait for encoding to complete and the root CID to be returned.
  const [dir] = await Promise.all([encodeDirectory(), writeBlocks()])
  console.log(`Root: ${dir.cid}`)
}
