import * as Writer from "../src/file/writer.js"
import * as Channel from "../src/writer/channel.js"
import * as UnixFS from "../src/lib.js"
import { assert } from "chai"

describe("Writer", () => {
  it("invalid state", () => {
    const channel = Channel.createBlockChannel()
    const state = Writer.init(
      channel.writable.getWriter(),
      {},
      UnixFS.defaults()
    )

    assert.throws(
      () =>
        Writer.update(
          // @ts-expect-error
          { type: "boom" },
          state
        ),
      /File Writer got unknown/
    )
  })

  it("can only write if open", () => {
    const channel = Channel.createBlockChannel()
    const open = Writer.init(
      channel.writable.getWriter(),
      {},
      UnixFS.defaults()
    )
    const close = Writer.close(open)
    assert.throws(
      () => Writer.write(close.state, new Uint8Array()),
      /Unable to perform write on closed file/
    )
  })

  it("close closed is noop", () => {
    const channel = Channel.createBlockChannel()
    const open = Writer.init(
      channel.writable.getWriter(),
      {},
      UnixFS.defaults()
    )
    const closed = Writer.close(open)

    assert.deepEqual(Writer.close(closed.state).state, closed.state)
  })
})
