import type {
  WriterOptions,
  EncoderSettings,
  WritableBlockStream,
  BlockWriter,
  View as FileWriterView,
  Writer as FileWriter,
  Options as FileWriterOptions,
  State as FileWriterSate,
  CloseOptions,
  Chunker,
  LayoutEngine,
  Block,
  MultihashHasher,
  MultihashDigest,
  EncodedFile,
} from "./file.js"

import type {
  DirectoryEntry,
  Writer as DirectoryWriter,
  View as DirectoryWriterView,
  Options as DirectoryWriterOptions,
  State as DirectoryWriterState,
} from "./directory.js"
import { Metadata } from "./unixfs.js"

export type {
  WriterOptions,
  CloseOptions,
  EncoderSettings,
  FileWriterOptions,
  FileWriterView,
  FileWriter,
  FileWriterSate,
  EncodedFile,
  BlockWriter,
  WritableBlockStream,
  DirectoryWriterView,
  DirectoryWriter,
  DirectoryWriterOptions,
  DirectoryWriterState,
  DirectoryEntry,
  Chunker,
  LayoutEngine,
  Block,
  MultihashHasher,
  MultihashDigest,
  Metadata,
}

/**
 *
 */
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
   *
   */
  createDirectoryWriter<Layout>(
    settings?: WriterOptions<Layout>
  ): DirectoryWriterView<L | Layout>
}

export interface Options<Layout extends unknown = unknown> {
  writable: WritableBlockStream
  settings?: EncoderSettings<Layout>
}
