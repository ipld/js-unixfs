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

### Importing a file

To encode a file you simply create file importer and write conten

```js
import * as UnixFSFile from "@ipld/unixfs/src/file.js"

const encodeFile = (blob) => {
  const { writer, ...importer } = FileImporter.createImporter()
  // Collects data coming out of ReadableStream into array
  const blocks = collect(importer.blocks)

  // Depending on runtime it may not be async iterable
  for await (const chunk of blob.stream()) {
    writer.write(chunk)
  }

  return { cid: await writer.close(), blocks: await blocks }
}
```

### Configure importer

You can configure importer by passing chunker, layout and encored implementations

```js
import * as UnixFS from "@ipld/unixfs"
import * as UnixFSFile from "@ipld/unixfs/src/file.js"
import * as Rabin from "@ipld/unixfs/src/file/chunker/rabin.js"
import * as Trickle from "@ipld/unixfs/src/file/layout/trickle.js"
import * as RawLeaf from "multiformats/codecs/raw"
import { sha256 } from "multiformats/hashes/sha2"

const demo = async blob => {
  const { writer, ...importer } = FileImporter.createImporter(
    { mode: 0644 },
    {
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
    }
  )
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
