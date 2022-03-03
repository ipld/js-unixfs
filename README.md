@ipld/unixfs

An implementation of the [UnixFS spec][] in JavaScript designed for use with
[multiformats][].

[unixfs spec]: https://github.com/ipfs/specs/blob/master/UNIXFS.md
[multiformats]: https://github.com/multiformats/js-multiformats

## Usage

`@ipld/unixfs` is designed to be used within multiformats but can be used
separately. Library provides `name`, `code`, `encode()`, `decode()` exports
as a valid (DAG-PB) `BlockCodec<0x70, Node>`, along with several other type
specific node constructor functions.

## License

Licensed under either of

- Apache 2.0, ([LICENSE-APACHE](LICENSE-APACHE) / http://www.apache.org/licenses/LICENSE-2.0)
- MIT ([LICENSE-MIT](LICENSE-MIT) / http://opensource.org/licenses/MIT)

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
