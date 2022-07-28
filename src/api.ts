import * as UnixFS from "./unixfs.js"
import type {
  WriterConfig,
  EncoderConfig,
  FileWriter,
  WritableBlockStream,
} from "./file.js"
import type { DirectoryWriter } from "./directory.js"

export type { Channel, Writer } from "./writer/channel.js"
export type {
  WriterConfig,
  EncoderConfig,
  FileWriter,
  BlockWriter,
  FileWriterConfig,
  WritableBlockStream,
} from "./file/api.js"
export {
  DirectoryWriter,
  DirectoryEntry,
  DirectoryConfig,
} from "./directory/api.js"

/**
 * Represents an IPLD [block][] channel with `reader` and `writer` halves. The
 * `writer` half provides filesystem like interface for encoding files &
 * directories into a [UnixFS][] DAG. The `reader` half emits all the IPLD
 * [blocks][] that are created in the process.
 *
 * [block]:https://ipld.io/docs/intro/primer/#blocks-vs-nodes
 * [UnixFS]:https://github.com/ipfs/specs/blob/main/UNIXFS.md
 */
export interface FileSystem<Layout extends unknown = unknown>
  extends FileSystemWriter<Layout> {
  readonly readable: ReadableStream<UnixFS.Block>

  readonly writable: WritableBlockStream

  blocks: AsyncIterableIterator<UnixFS.Block>
}

export interface FileSystemWriter<L extends unknown = unknown>
  extends FileSystemConfig<L> {
  /**
   * Creates new file writer that will write blocks into the same `BlockQueue`
   * as this `DirectoryWriter`.
   *
   * ⚠️ Please note that file represented by the returned writer is not added to
   * to this directory,  you need to do that explicitly via `write` call.
   */
  createFileWriter<Layout>(
    options?: WriterConfig<Layout>
  ): FileWriter<L | Layout>

  /**
   * Creates new directory writer that will write blocks into the same
   * `BlockQueue` as this `DirectoryWriter`.
   *
   * * ⚠️ Please note that directory represented by returned writer is not
   * added to this directory, you need to do that explicitly via `write` call.
   *
   */
  createDirectoryWriter(options?: WriterConfig): DirectoryWriter

  close(): Promise<void>
}

export interface FileSystemConfig<Layout extends unknown = unknown> {
  writable: WritableBlockStream
  config?: EncoderConfig<Layout>
}
