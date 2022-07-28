import type {
  WriterOptions,
  EncoderSettings,
  FileWriter,
  WritableBlockStream,
  BlockWriter,
  FileWriterOptions,
  Chunker,
  LayoutEngine,
  Block,
  MultihashHasher,
  MultihashDigest,
  EncodedFile,
} from "./file.js"

import type {
  DirectoryWriter,
  DirectoryEntry,
  DirectoryWriterOptions,
} from "./directory.js"

export type {
  WriterOptions,
  EncoderSettings,
  FileWriter,
  EncodedFile,
  BlockWriter,
  FileWriterOptions,
  WritableBlockStream,
  DirectoryWriter,
  DirectoryEntry,
  DirectoryWriterOptions,
  Chunker,
  LayoutEngine,
  Block,
  MultihashHasher,
  MultihashDigest,
}

/**
 * Represents [UnixFS][] DAG writer with a filesystem like API for
 * encoding files & directories into a [UnixFS][] DAG.
 *
 * [block]:https://ipld.io/docs/intro/primer/#blocks-vs-nodes
 * [UnixFS]:https://github.com/ipfs/specs/blob/main/UNIXFS.md
 */
export interface FileSystemWriter<L extends unknown = unknown> {
  /**
   * Underlaying stream where [UnixFS][] blocks will be written into.
   */
  readonly writable: WritableBlockStream
  /**
   * Encoder configuration of this writer.
   */

  readonly settings: EncoderSettings<L>

  /**
   * Creates new file writer that will write blocks into the same underlying
   * stream. It is mostly convinience function for passing same stream and
   * encoder configuration.
   */
  createFileWriter<Layout>(
    settings?: WriterOptions<Layout>
  ): FileWriter<L | Layout>

  /**
   * Creates new directory writer that will write blocks into the same
   * underlying stream as this writer. It is mostly convinienc function for
   * passing same stream and encoder configuration.
   *
   */
  createDirectoryWriter(settings?: WriterOptions): DirectoryWriter

  /**
   * Closes this writer and corresponding
   */
  close(): Promise<void>
}

export interface FileSystemWriterOptions<Layout extends unknown = unknown> {
  writable: WritableBlockStream
  settings?: EncoderSettings<Layout>
}
