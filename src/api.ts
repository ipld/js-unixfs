import type {
  Block,
  BlockWriter,
  Chunker,
  CloseOptions,
  EncodedFile,
  EncoderSettings,
  LayoutEngine,
  MultihashDigest,
  MultihashHasher,
  Options as FileWriterOptions,
  State as FileWriterSate,
  View as FileWriterView,
  WritableBlockStream,
  Writer as FileWriter,
  WriterOptions,
} from "./file.js"

import type {
  DirectoryEntry,
  Options as DirectoryWriterOptions,
  State as DirectoryWriterState,
  View as DirectoryWriterView,
  Writer as DirectoryWriter,
} from "./directory.js"
import { Metadata } from "./unixfs.js"

export type {
  Block,
  BlockWriter,
  Chunker,
  CloseOptions,
  DirectoryEntry,
  DirectoryWriter,
  DirectoryWriterOptions,
  DirectoryWriterState,
  DirectoryWriterView,
  EncodedFile,
  EncoderSettings,
  FileWriter,
  FileWriterOptions,
  FileWriterSate,
  FileWriterView,
  LayoutEngine,
  Metadata,
  MultihashDigest,
  MultihashHasher,
  WritableBlockStream,
  WriterOptions,
}

export interface Writer {
  /**
   * Closes this writer and corresponding
   */
  close(options?: CloseOptions): Promise<this>
}

/**
 * Represents [UnixFS][] DAG writer with a filesystem like API for
 * encoding files & directories into a [UnixFS][] DAG.
 *
 * [block]:https://ipld.io/docs/intro/primer/#blocks-vs-nodes
 * [UnixFS]:https://github.com/ipfs/specs/blob/main/UNIXFS.md
 */
export interface View<L extends unknown = unknown> extends Writer {
  /**
   * Underlaying stream where [UnixFS][] blocks will be written into.
   */
  readonly writer: BlockWriter
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
  ): FileWriterView<L | Layout>

  /**
   * Creates new directory writer that will write blocks into the same
   * underlying stream as this writer. It is mostly convinienc function for
   * passing same stream and encoder configuration.
   */
  createDirectoryWriter<Layout>(
    settings?: WriterOptions<Layout>
  ): DirectoryWriterView<L | Layout>
}

export interface Options<Layout extends unknown = unknown> {
  writable: WritableBlockStream
  settings?: EncoderSettings<Layout>
}
