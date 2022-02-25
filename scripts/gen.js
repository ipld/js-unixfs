import child_process from "child_process"
import * as FS from "fs"

const baseURL = new URL("../", import.meta.url)
export const main = () => {
  console.log("Generating js for protobuf")
  const js = child_process.execSync(
    "pbjs -t static-module -w es6 -r unixfs --force-number --no-verify --no-delimited --no-create --no-beautify --no-defaults --lint eslint-disable ./unixfs.proto"
  )

  const fixedJS = js
    .toString()
    .replace(
      'import * as $protobuf from "protobufjs/minimal"',
      'import $protobuf from "protobufjs/minimal.js"'
    )

  FS.writeFileSync(new URL("./gen/unixfs.js", baseURL), fixedJS)

  console.log("Generating ts for protobuf")
  const ts = child_process.execSync("pbts gen/unixfs.js")
  const fixedTS = ts
    .toString()
    .replace(/export class/g, "export declare class")
    .replace(/\n(\s+)enum /g, "\n export enum ")

  FS.writeFileSync(new URL("./gen/unixfs.ts", baseURL), fixedTS)
}

main()
