/* eslint-disable import/export */
/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { decodeMessage, encodeMessage, enumeration, MaxLengthError, message } from 'protons-runtime';
import { alloc as uint8ArrayAlloc } from 'uint8arrays/alloc';
export var Data;
(function (Data) {
    let DataType;
    (function (DataType) {
        DataType["Raw"] = "Raw";
        DataType["Directory"] = "Directory";
        DataType["File"] = "File";
        DataType["Metadata"] = "Metadata";
        DataType["Symlink"] = "Symlink";
        DataType["HAMTShard"] = "HAMTShard";
    })(DataType = Data.DataType || (Data.DataType = {}));
    let __DataTypeValues;
    (function (__DataTypeValues) {
        __DataTypeValues[__DataTypeValues["Raw"] = 0] = "Raw";
        __DataTypeValues[__DataTypeValues["Directory"] = 1] = "Directory";
        __DataTypeValues[__DataTypeValues["File"] = 2] = "File";
        __DataTypeValues[__DataTypeValues["Metadata"] = 3] = "Metadata";
        __DataTypeValues[__DataTypeValues["Symlink"] = 4] = "Symlink";
        __DataTypeValues[__DataTypeValues["HAMTShard"] = 5] = "HAMTShard";
    })(__DataTypeValues || (__DataTypeValues = {}));
    (function (DataType) {
        DataType.codec = () => {
            return enumeration(__DataTypeValues);
        };
    })(DataType = Data.DataType || (Data.DataType = {}));
    let _codec;
    Data.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if (obj.Type != null && __DataTypeValues[obj.Type] !== 0) {
                    w.uint32(8);
                    Data.DataType.codec().encode(obj.Type, w);
                }
                if ((obj.Data != null && obj.Data.byteLength > 0)) {
                    w.uint32(18);
                    w.bytes(obj.Data);
                }
                if ((obj.filesize != null && obj.filesize !== 0n)) {
                    w.uint32(24);
                    w.uint64(obj.filesize);
                }
                if (obj.blocksizes != null) {
                    for (const value of obj.blocksizes) {
                        w.uint32(32);
                        w.uint64(value);
                    }
                }
                if ((obj.hashType != null && obj.hashType !== 0n)) {
                    w.uint32(40);
                    w.uint64(obj.hashType);
                }
                if ((obj.fanout != null && obj.fanout !== 0n)) {
                    w.uint32(48);
                    w.uint64(obj.fanout);
                }
                if ((obj.mode != null && obj.mode !== 0)) {
                    w.uint32(56);
                    w.uint32(obj.mode);
                }
                if (obj.mtime != null) {
                    w.uint32(66);
                    UnixTime.codec().encode(obj.mtime, w);
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length, opts = {}) => {
                const obj = {
                    Type: DataType.Raw,
                    Data: uint8ArrayAlloc(0),
                    filesize: 0n,
                    blocksizes: [],
                    hashType: 0n,
                    fanout: 0n,
                    mode: 0
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1: {
                            obj.Type = Data.DataType.codec().decode(reader);
                            break;
                        }
                        case 2: {
                            obj.Data = reader.bytes();
                            break;
                        }
                        case 3: {
                            obj.filesize = reader.uint64();
                            break;
                        }
                        case 4: {
                            if (opts.limits?.blocksizes != null && obj.blocksizes.length === opts.limits.blocksizes) {
                                throw new MaxLengthError('Decode error - map field "blocksizes" had too many elements');
                            }
                            obj.blocksizes.push(reader.uint64());
                            break;
                        }
                        case 5: {
                            obj.hashType = reader.uint64();
                            break;
                        }
                        case 6: {
                            obj.fanout = reader.uint64();
                            break;
                        }
                        case 7: {
                            obj.mode = reader.uint32();
                            break;
                        }
                        case 8: {
                            obj.mtime = UnixTime.codec().decode(reader, reader.uint32(), {
                                limits: opts.limits?.mtime
                            });
                            break;
                        }
                        default: {
                            reader.skipType(tag & 7);
                            break;
                        }
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    Data.encode = (obj) => {
        return encodeMessage(obj, Data.codec());
    };
    Data.decode = (buf, opts) => {
        return decodeMessage(buf, Data.codec(), opts);
    };
})(Data || (Data = {}));
export var UnixTime;
(function (UnixTime) {
    let _codec;
    UnixTime.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.seconds != null && obj.seconds !== 0n)) {
                    w.uint32(8);
                    w.int64(obj.seconds);
                }
                if ((obj.fractionalNanoseconds != null && obj.fractionalNanoseconds !== 0)) {
                    w.uint32(21);
                    w.fixed32(obj.fractionalNanoseconds);
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length, opts = {}) => {
                const obj = {
                    seconds: 0n,
                    fractionalNanoseconds: 0
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1: {
                            obj.seconds = reader.int64();
                            break;
                        }
                        case 2: {
                            obj.fractionalNanoseconds = reader.fixed32();
                            break;
                        }
                        default: {
                            reader.skipType(tag & 7);
                            break;
                        }
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    UnixTime.encode = (obj) => {
        return encodeMessage(obj, UnixTime.codec());
    };
    UnixTime.decode = (buf, opts) => {
        return decodeMessage(buf, UnixTime.codec(), opts);
    };
})(UnixTime || (UnixTime = {}));
export var Metadata;
(function (Metadata) {
    let _codec;
    Metadata.codec = () => {
        if (_codec == null) {
            _codec = message((obj, w, opts = {}) => {
                if (opts.lengthDelimited !== false) {
                    w.fork();
                }
                if ((obj.mimeType != null && obj.mimeType !== '')) {
                    w.uint32(10);
                    w.string(obj.mimeType);
                }
                if (opts.lengthDelimited !== false) {
                    w.ldelim();
                }
            }, (reader, length, opts = {}) => {
                const obj = {
                    mimeType: ''
                };
                const end = length == null ? reader.len : reader.pos + length;
                while (reader.pos < end) {
                    const tag = reader.uint32();
                    switch (tag >>> 3) {
                        case 1: {
                            obj.mimeType = reader.string();
                            break;
                        }
                        default: {
                            reader.skipType(tag & 7);
                            break;
                        }
                    }
                }
                return obj;
            });
        }
        return _codec;
    };
    Metadata.encode = (obj) => {
        return encodeMessage(obj, Metadata.codec());
    };
    Metadata.decode = (buf, opts) => {
        return decodeMessage(buf, Metadata.codec(), opts);
    };
})(Metadata || (Metadata = {}));
