import * as UnixFS from "../unixfs.js"
import type { State } from "../file/api.js"

export type { BlockQueue, FileWriterConfig, FileWriter } from "../file/api.js"

export interface DirectoryWriter {
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
   * const demo = async () => {
   *   const root = createDirectoryWriter()
   *   const txt = root.createFileWriter()
   *   txt.write(new TextEncoder().encode('hello world'))
   *   const entry = {
   *     name: 'hello.txt',
   *     link: await txt.close()
   *   }
   *   root.write(entry)
   *   return await root.close()
   * }
   * ```
   */

  write(entry: DirectoryEntry): DirectoryWriter
}

export interface DirectoryEntry {
  name: string
  link: UnixFS.FileLink | UnixFS.DirectoryLink
}
