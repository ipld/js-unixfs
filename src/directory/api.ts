import { FileWriterConfig } from "../file.js"
import * as UnixFS from "../unixfs.js"
import type { BlockWriter } from "../file.js"

export type { BlockWriter, FileWriterConfig, FileWriter } from "../file/api.js"

export interface DirectoryWriter {
  // /**
  //  * Adds new entry (either directory or a file) to this directory. Please note
  //  * that it is API consumer responsibility to ensure that underlying entry
  //  * blocks are written into the `BlockQueue` of this `DiretoryWriter` if so
  //  * desired. To include blocks of the added entry you can use `createFileWriter`
  //  * and `createDirectoryWriter` methods.
  //  *
  //  * ⚠️ Please note that call will throw an exception if the conflicting file
  //  * name is used.
  //  *
  //  * @example
  //  * ```
  //  * import as UnixFS from "@ipld/dag-unixfs"
  //  *
  //  * const demo = async (writable) => {
  //  *   const writer = UnixFS.fromWriter(writable.getWriter())
  //  *   const directory = writer.createDirectory()
  //  *   const file = writer.createFile()
  //  *   file.write(new TextEncoder().encode('hello world'))
  //  *   directory.write('hello.txt',  await file.close())
  //  *   return await directory.close()
  //  * })
  //  *
  //  * const { readable, writable } = new TransformStream()
  //  * demo(writable)
  //  * ```
  //  */

  write(
    name: string,
    entry: UnixFS.FileLink | UnixFS.DirectoryLink,
    options?: WriteOptions
  ): DirectoryWriter
  remove(name: string): DirectoryWriter

  close(): Promise<UnixFS.DirectoryLink>
  fork(): DirectoryWriter
}

export interface WriteOptions {
  overwrite?: boolean
}

export interface DirectoryEntry {
  name: string
  link: EntryLink
}

export interface State<Layout extends unknown = unknown> {
  readonly entries: Map<string, UnixFS.DirectoryEntryLink>
  readonly metadata: UnixFS.Metadata
  readonly writer: BlockWriter
  readonly config: FileWriterConfig<Layout>

  readonly preventClose: boolean
}

export interface DirectoryWriterView<Layout extends unknown = unknown>
  extends DirectoryWriter,
    State<Layout> {}

export type EntryLink = UnixFS.FileLink | UnixFS.DirectoryLink
