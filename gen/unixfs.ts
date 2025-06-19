/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */

import { type Codec, decodeMessage, type DecodeOptions, encodeMessage, enumeration, MaxLengthError, message } from 'protons-runtime'
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc'
import type { Uint8ArrayList } from 'uint8arraylist'

export interface Data {
  Type: Data.DataType
  Data: Uint8Array
  filesize: bigint
  blocksizes: bigint[]
  hashType: bigint
  fanout: bigint
  mode: number
  mtime?: UnixTime
}

export namespace Data {
  export enum DataType {
    Raw = 'Raw',
    Directory = 'Directory',
    File = 'File',
    Metadata = 'Metadata',
    Symlink = 'Symlink',
    HAMTShard = 'HAMTShard'
  }

  enum __DataTypeValues {
    Raw = 0,
    Directory = 1,
    File = 2,
    Metadata = 3,
    Symlink = 4,
    HAMTShard = 5
  }

  export namespace DataType {
    export const codec = (): Codec<DataType> => {
      return enumeration<DataType>(__DataTypeValues)
    }
  }

  let _codec: Codec<Data>

  export const codec = (): Codec<Data> => {
    if (_codec == null) {
      _codec = message<Data>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if (obj.Type != null && __DataTypeValues[obj.Type] !== 0) {
          w.uint32(8)
          Data.DataType.codec().encode(obj.Type, w)
        }

        if ((obj.Data != null && obj.Data.byteLength > 0)) {
          w.uint32(18)
          w.bytes(obj.Data)
        }

        if ((obj.filesize != null && obj.filesize !== 0n)) {
          w.uint32(24)
          w.uint64(obj.filesize)
        }

        if (obj.blocksizes != null) {
          for (const value of obj.blocksizes) {
            w.uint32(32)
            w.uint64(value)
          }
        }

        if ((obj.hashType != null && obj.hashType !== 0n)) {
          w.uint32(40)
          w.uint64(obj.hashType)
        }

        if ((obj.fanout != null && obj.fanout !== 0n)) {
          w.uint32(48)
          w.uint64(obj.fanout)
        }

        if ((obj.mode != null && obj.mode !== 0)) {
          w.uint32(56)
          w.uint32(obj.mode)
        }

        if (obj.mtime != null) {
          w.uint32(66)
          UnixTime.codec().encode(obj.mtime, w)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          Type: DataType.Raw,
          Data: uint8ArrayAlloc(0),
          filesize: 0n,
          blocksizes: [],
          hashType: 0n,
          fanout: 0n,
          mode: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.Type = Data.DataType.codec().decode(reader)
              break
            }
            case 2: {
              obj.Data = reader.bytes()
              break
            }
            case 3: {
              obj.filesize = reader.uint64()
              break
            }
            case 4: {
              if (opts.limits?.blocksizes != null && obj.blocksizes.length === opts.limits.blocksizes) {
                throw new MaxLengthError('Decode error - map field "blocksizes" had too many elements')
              }

              obj.blocksizes.push(reader.uint64())
              break
            }
            case 5: {
              obj.hashType = reader.uint64()
              break
            }
            case 6: {
              obj.fanout = reader.uint64()
              break
            }
            case 7: {
              obj.mode = reader.uint32()
              break
            }
            case 8: {
              obj.mtime = UnixTime.codec().decode(reader, reader.uint32(), {
                limits: opts.limits?.mtime
              })
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Data>): Uint8Array => {
    return encodeMessage(obj, Data.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Data>): Data => {
    return decodeMessage(buf, Data.codec(), opts)
  }
}

export interface UnixTime {
  seconds: bigint
  fractionalNanoseconds: number
}

export namespace UnixTime {
  let _codec: Codec<UnixTime>

  export const codec = (): Codec<UnixTime> => {
    if (_codec == null) {
      _codec = message<UnixTime>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.seconds != null && obj.seconds !== 0n)) {
          w.uint32(8)
          w.int64(obj.seconds)
        }

        if ((obj.fractionalNanoseconds != null && obj.fractionalNanoseconds !== 0)) {
          w.uint32(21)
          w.fixed32(obj.fractionalNanoseconds)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          seconds: 0n,
          fractionalNanoseconds: 0
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.seconds = reader.int64()
              break
            }
            case 2: {
              obj.fractionalNanoseconds = reader.fixed32()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<UnixTime>): Uint8Array => {
    return encodeMessage(obj, UnixTime.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<UnixTime>): UnixTime => {
    return decodeMessage(buf, UnixTime.codec(), opts)
  }
}

export interface Metadata {
  mimeType: string
}

export namespace Metadata {
  let _codec: Codec<Metadata>

  export const codec = (): Codec<Metadata> => {
    if (_codec == null) {
      _codec = message<Metadata>((obj, w, opts = {}) => {
        if (opts.lengthDelimited !== false) {
          w.fork()
        }

        if ((obj.mimeType != null && obj.mimeType !== '')) {
          w.uint32(10)
          w.string(obj.mimeType)
        }

        if (opts.lengthDelimited !== false) {
          w.ldelim()
        }
      }, (reader, length, opts = {}) => {
        const obj: any = {
          mimeType: ''
        }

        const end = length == null ? reader.len : reader.pos + length

        while (reader.pos < end) {
          const tag = reader.uint32()

          switch (tag >>> 3) {
            case 1: {
              obj.mimeType = reader.string()
              break
            }
            default: {
              reader.skipType(tag & 7)
              break
            }
          }
        }

        return obj
      })
    }

    return _codec
  }

  export const encode = (obj: Partial<Metadata>): Uint8Array => {
    return encodeMessage(obj, Metadata.codec())
  }

  export const decode = (buf: Uint8Array | Uint8ArrayList, opts?: DecodeOptions<Metadata>): Metadata => {
    return decodeMessage(buf, Metadata.codec(), opts)
  }
}
