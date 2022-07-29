/* eslint-env mocha */
import { expect, assert } from "chai"
import * as BufferQueue from "../../../src/file/chunker/buffer.js"

describe("chunker buffer", () => {
  it("concat two uint8arrays", () => {
    const buffer = BufferQueue.empty()
      .push(new Uint8Array(12).fill(1))
      .push(new Uint8Array(8).fill(2))

    assert.equal(buffer.byteLength, 20)
    assert.equal(buffer.length, 20)

    assert.equal(buffer[0], 1)
    assert.equal(buffer[1], 1)
    assert.equal(buffer[12], 2)
    assert.equal(buffer[19], 2)
    assert.equal(buffer[20], undefined)
  })

  it("slice", () => {
    const buffer = BufferQueue.empty()
      .push(new Uint8Array(12).fill(1))
      .push(new Uint8Array(8).fill(2))
      .push(new Uint8Array(0))

    const expect = new Uint8Array([
      ...new Uint8Array(12).fill(1),
      ...new Uint8Array(8).fill(2),
    ])

    const s0 = buffer.slice(0, 0)
    assert.equal(s0.byteLength, 0)

    assert.deepEqual([...buffer.slice(-1, 4)], [...expect.slice(-1, 4)])
    assert.deepEqual([...buffer.slice(-1, -4)], [...expect.slice(-1, -4)])
    assert.deepEqual([...buffer.slice(8, 100)], [...expect.slice(8, 100)])

    const s1 = buffer.slice(0, 3)
    assert.deepEqual(s1.byteLength, 3)
    assert.deepEqual([...s1], [1, 1, 1])

    const s2 = buffer.slice(3, 13)
    assert.equal(s2.byteLength, 10)
    assert.deepEqual([...s2], [1, 1, 1, 1, 1, 1, 1, 1, 1, 2])

    const s3 = [
      ...new Uint8Array(12).fill(1),
      ...new Uint8Array(8).fill(2),
    ].slice(3, 13)

    assert.deepEqual([...s3], [...s2])
  })

  it("create", () => {
    const buffer = BufferQueue.create([
      new Uint8Array(12).fill(1),
      new Uint8Array(8).fill(2),
    ])

    assert.equal(buffer.byteLength, 20)
    assert.equal(buffer.length, 20)

    assert.equal(buffer[0], 1)
    assert.equal(buffer[1], 1)
    assert.equal(buffer[12], 2)
    assert.equal(buffer[19], 2)
    assert.equal(buffer[20], undefined)
  })
})
