import TSV from "tsv"
import * as FS from "fs"

export const main = () => {
  const url = new URL(
    "../test/dataset/convergence_rawdata.tsv",
    import.meta.url
  )
  const json = []
  for (const entry of TSV.parse(FS.readFileSync(url).toString().trim())) {
    const data = Object.fromEntries(
      Object.values(entry).map(value => [
        `${value.slice(0, value.indexOf(":"))}`,
        value.slice(value.indexOf(":") + 1),
      ])
    )

    json.push({
      source: data.Data,
      impl: data.Impl,
      trickle: JSON.parse(data.Trickle),
      rawLeaves: JSON.parse(data.RawLeaves),
      inlining: JSON.parse(data.Inlining),
      cidVersion: JSON.parse(data.CidVer),
      chunker: data.Chunker,
      cmd: data.Cmd,
      cid: data.CID,
    })
  }

  FS.writeFileSync(
    new URL("convergence_rawdata.js", url),
    `export default ${JSON.stringify(json, null, 2)}`
  )
}

main()
