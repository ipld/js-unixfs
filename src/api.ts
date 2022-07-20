import * as UnixFS from "./unixfs.js"
import type { FileWriterConfig, FileWriter } from "./file.js"
import type { DirectoryWriter } from "./directory.js"

import type { Writer } from "./writer/channel.js"
export type { Channel, Writer } from "./writer/channel.js"
export { FileWriterConfig, FileWriter, BlockWriter } from "./file/api.js"
export { DirectoryWriter, DirectoryEntry } from "./directory/api.js"

/**
 * Represents an IPLD [block][] channel with `reader` and `writer` halves. The
 * `writer` half provides filesystem like interface for encoding files &
 * directories into a [UnixFS][] DAG. The `reader` half emits all the IPLD
 * [blocks][] that are created in the process.
 *
 * [block]:https://ipld.io/docs/intro/primer/#blocks-vs-nodes
 * [UnixFS]:https://github.com/ipfs/specs/blob/main/UNIXFS.md
 */
export interface FileSystem<Layout extends unknown = unknown> {
  readonly readable: ReadableStream<UnixFS.Block>

  readonly writer: FileSystemWriter<Layout>
}

export interface FileSystemWriter<L extends unknown = unknown> {
  readonly writer: Writer<UnixFS.Block>
  /**
   * Creates new file writer that will write blocks into the same `BlockQueue`
   * as this `DirectoryWriter`.
   *
   * ⚠️ Please note that file represented by the returned writer is not added to
   * to this directory,  you need to do that explicitly via `write` call.
   */
  createFileWriter<Layout>(
    metadata?: UnixFS.Metadata,
    config?: Partial<FileWriterConfig<L | Layout>>
  ): FileWriter<L | Layout>

  /**
   * Creates new directory writer that will write blocks into the same
   * `BlockQueue` as this `DirectoryWriter`.
   *
   * * ⚠️ Please note that directory represented by returned writer is not
   * added to this directory, you need to do that explicitly via `write` call.
   *
   */
  createDirectoryWriter(metadata?: UnixFS.Metadata): DirectoryWriter

  close(): Promise<void>
}

//   /**
//    * Creates new file writer that will write blocks into the same `BlockQueue`
//    * as this `DirectoryWriter`.
//    *
//    * ⚠️ Please note that file represented by the returned writer is not added to
//    * to this directory,  you need to do that explicitly via `write` call.
//    */
//   createFileWriter<L>(
//     metadata?: UnixFS.Metadata,
//     config?: Partial<FileWriterConfig<L | Layout>>
//   ): FileWriter<L | Layout>

//   /**
//    * Creates new directory writer that will write blocks into the same
//    * `BlockQueue` as this `DirectoryWriter`.
//    *
//    * * ⚠️ Please note that directory represented by returned writer is not
//    * added to this directory, you need to do that explicitly via `write` call.
//    *
//    */
//   createDirectoryWriter<L>(
//     metadata?: UnixFS.Metadata,
//     config?: Partial<FileWriterConfig<L | Layout>>
//   ): DirectoryWriter<L | Layout>
// }

// export interface Writer<Layout extends unknown = unknown> {}
