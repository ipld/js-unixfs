import * as UnixFS from "./unixfs.js"
import type { FileWriterConfig, FileWriter } from "./file.js"
import type { DirectoryWriter } from "./directory.js"

export * from "./file/api.js"
export * from "./directory/api.js"

export interface Writer<Layout extends unknown = unknown> {
  /**
   * Creates new file writer that will write blocks into the same `BlockQueue`
   * as this `DirectoryWriter`.
   *
   * ⚠️ Please note that file represented by the returned writer is not added to
   * to this directory,  you need to do that explicitly via `write` call.
   */
  createFileWriter<L>(
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
  createDirectoryWriter<L>(
    metadata?: UnixFS.Metadata,
    config?: Partial<FileWriterConfig<L | Layout>>
  ): DirectoryWriter<L | Layout>
}
