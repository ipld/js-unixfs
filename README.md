# @ipld/unixfs

An implementation of the [UnixFS spec][] in JavaScript designed for use with
[multiformats][].

[unixfs spec]: https://github.com/ipfs/specs/blob/master/UNIXFS.md
[multiformats]: https://github.com/multiformats/js-multiformats

## Overview

This library provides functionality similar to [ipfs-unixfs-importer][], but it had been designed around different set of use cases:

1. Writing into Content Addressable Archives ([CAR][]).

   In order to allow encoding file(s) into arbitrary number of CARs, library makes no assumbtions about how blocks will be consumed by returning [ReadableStream][] of blocks and leaving it up to caller to handle the rest.

1. Incremental and resumable writes

   Instead of passing a stream of files, user creates files, writes into them and when finished gets `Promise<CID>` for it. This removes need for mapping files back to their CIDs streamed on the other end.

1. Complete control of memory and concurrency

   By using writer style API users can choose how many files to write concurrently and change that decision based on other tasks application performs. User can also specify buffer size to be able to tweak read/write coordination.

1. No indirect configuration

   Library removes indirection by taking approach similar to [multiformats][] library. Instead of passing chunker and layout config options, you pass chunker / layout / encoder interface implementations.

### Usage

You can encode a file as follows

```js
import * as UnixFS from "@ipld/unixfs"

// Create a redable & writable streams with internal queue that can
// hold around 32 blocks
const { readable, writable } = new TransformStream(
  {},
  UnixFS.withCapacity(1048576 * 32)
)
// Next we create a writer with filesystem like API for encoding files and
// directories into IPLD blocks that will come out on `readable` end.
const writer = UnixFS.createWriter({ writable })

// Create file writer that can be used to encode UnixFS file.
const file = UnixFS.createFileWriter(writer)
// write some content
file.write(new TextEncoder().encode("hello world"))
// Finalize file by closing it.
const { cid } = await file.close()

// close the writer to close underlying block stream.
writer.close()

// We could encode all this as car file
encodeCAR({ roots: [cid], blocks: readable })
```

You can encode (non sharded) directories with provided API as well

```ts
import * as UnixFS from "@ipld/unixfs"

export const demo = async () => {
  const { readable, writable } = new TransformStream()
  const writer = UnixFS.createWriter({ writable })

  // write a file
  const file = UnixFS.createFileWriter(writer)
  file.write(new TextEncoder().encode("hello world"))
  const fileLink = await file.close()

  // create directory and add a file we encoded above
  const dir = UnixFS.createDirectoryWriter(writer)
  dir.set("intro.md", fileLink)
  const dirLink = await dir.close()

  // now wrap above directory with another and also add the same file
  // there
  const root = UnixFS.createDirectoryWriter(fs)
  root.set("user", dirLink)
  root.set("hello.md", fileLink)

  // Creates following UnixFS structure where intro.md and hello.md link to same
  // IPFS file.
  // ./
  // ./user/intro.md
  // ./hello.md
  const rootLink = await root.close()
  // ...
  writer.close()
}
```

### Configuration

You can configure DAG layout, chunking and bunch of other things by providing API compatible components. Library provides bunch of them but you can also bring your own.

```js
import * as UnixFS from "@ipld/unixfs"
import * as Rabin from "@ipld/unixfs/file/chunker/rabin"
import * as Trickle from "@ipld/unixfs/file/layout/trickle"
import * as RawLeaf from "multiformats/codecs/raw"
import { sha256 } from "multiformats/hashes/sha2"

const demo = async blob => {
  const { readable, writable } = new TransformStream()
  const writer = UnixFS.createWriter({
    writable,
    // you can pass only things you want to override
    settings: {
      fileChunker: await Rabin.create({
        avg: 60000,
        min: 100,
        max: 662144,
      }),
      fileLayout: Trickle.configure({ maxDirectLeaves: 100 }),
      // Encode leaf nodes as raw blocks
      fileChunkEncoder: RawLeaf,
      smallFileEncoder: RawLeaf,
      fileEncoder: UnixFS,
      hasher: sha256,
    },
  })

  const file = UnixFS.createFileWriter(writer)
  // ...
}
```

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / http://www.apache.org/licenses/LICENSE-2.0)
- MIT ([LICENSE-MIT](LICENSE-MIT) / http://opensource.org/licenses/MIT)

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

[ipfs-unixfs-importer]: https://www.npmjs.com/package/ipfs-unixfs-importer
[readablestream]: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
[car]: https://ipld.io/specs/transport/car/carv1/
[`transformstream`]: https://developer.mozilla.org/en-US/docs/Web/API/TransformStream
[`writablestream`]: https://developer.mozilla.org/en-US/docs/Web/API/WritableStream
