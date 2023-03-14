import * as UnixFS from "../unixfs.js"
import type { BlockWriter } from "../file.js"
import type {
  Metadata,
  DirectoryEntryLink,
  DirectoryLink,
  FileLink,
} from "../unixfs.js"
import type { CloseOptions, Options, EncoderSettings } from "../file.js"
export type {
  WritableBlockStream,
  BlockWriter,
  WriterOptions,
  View as FileWriterView,
} from "../file/api.js"

export type {
  Options,
  CloseOptions,
  EncoderSettings,
  Metadata,
  DirectoryEntryLink,
  DirectoryLink,
  FileLink,
  UnixFS,
}

export interface Writer<Layout extends unknown = unknown> {
  /**
   * Adds new entry (either directory or a file) to this directory. Please note
   * that it is API consumer responsibility to ensure that underlying entry
   * blocks are written into the `BlockQueue` of this `DiretoryWriter` if so
   * desired. To include blocks of the added entry you can use `createFileWriter`
   * and `createDirectoryWriter` methods.
   *
   * ⚠️ Please note that call will throw an exception if the conflicting file
   * name is used.
   *
   * @example
   * ```
   * import as UnixFS from "@ipld/dag-unixfs"
   *
   * const demo = async (writable) => {
   *   const writer = UnixFS.fromWriter(writable.getWriter())
   *   const directory = writer.createDirectory()
   *   const file = writer.createFile()
   *   file.write(new TextEncoder().encode('hello world'))
   *   directory.write('hello.txt',  await file.close())
   *   return await directory.close()
   * })
   *
   * const { readable, writable } = new TransformStream()
   * demo(writable)
   * ```
   */
  set(name: string, entry: EntryLink, options?: WriteOptions): this
  remove(name: string): this

  close(options?: CloseOptions): Promise<DirectoryLink>
  fork<L>(options?: Partial<Options<L>>): View<Layout | L>
}

export interface WriteOptions {
  overwrite?: boolean
}

export interface DirectoryEntry {
  name: string
  link: EntryLink
}

export interface State<Layout extends unknown = unknown> {
  readonly entries: Map<string, EntryLink>
  readonly metadata: Metadata
  readonly writer: BlockWriter
  readonly settings: EncoderSettings<Layout>

  closed: boolean
}

export interface View<Layout extends unknown = unknown> extends Writer<Layout> {
  readonly writer: BlockWriter
  readonly settings: EncoderSettings<Layout>

  state: State<Layout>

  entries(): IterableIterator<[string, EntryLink]>
  has(name: string): boolean

  size: number
}

export type EntryLink = FileLink | DirectoryLink
