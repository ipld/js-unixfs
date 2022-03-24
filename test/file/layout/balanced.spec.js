/* eslint-env mocha */
import { assert } from "chai"
import * as Balanced from "../../../src/file/layout/balanced.js"
import * as Slice from "../../../src/file/chunker/buffer.js"

describe("balanced layout", () => {
  it("empty produces empty leaf node", () => {
    const layout = Balanced.open()
    const { root, ...rest } = Balanced.close(layout)
    assert.deepEqual(root, {
      id: 1,
      metadata: undefined,
    })
    assert.deepEqual(rest, { nodes: [], leaves: [] })
  })

  it("single leaf does not produces root", () => {
    const { nodes, leaves, layout } = Balanced.write(Balanced.open(), [
      Slice.create([], 0, 4),
    ])
    assert.deepEqual(leaves, [])
    assert.deepEqual(nodes, [])

    const { root, ...rest } = Balanced.close(layout)
    assert.deepEqual(root, {
      id: 1,
      content: Slice.create([], 0, 4),
      metadata: undefined,
    })
    assert.deepEqual(rest, { nodes: [], leaves: [] })
  })

  it("two leaves produce a root", () => {
    const { nodes, leaves, layout } = Balanced.write(Balanced.open(), [
      Slice.create([], 0, 4),
      Slice.create([], 4, 8),
    ])
    assert.deepEqual(nodes, [])
    assert.deepEqual(leaves, [
      {
        id: 1,
        content: Slice.create([], 0, 4),
      },
      {
        id: 2,
        content: Slice.create([], 4, 8),
      },
    ])

    const { root, ...rest } = Balanced.close(layout)
    assert.deepEqual(root, {
      id: 3,
      children: [1, 2],
      metadata: undefined,
    })

    assert.deepEqual(rest, { nodes: [], leaves: [] })
  })

  it("overflows into second node", () => {
    let balanced = Balanced.open({ width: 3 })
    {
      const { nodes, leaves, layout } = Balanced.write(balanced, [
        Slice.create([], 0, 4),
        Slice.create([], 4, 8),
      ])
      assert.deepEqual(nodes, [])
      assert.deepEqual(leaves, [
        {
          id: 1,
          content: Slice.create([], 0, 4),
        },
        {
          id: 2,
          content: Slice.create([], 4, 8),
        },
      ])

      balanced = layout
    }

    {
      const { nodes, leaves, layout } = Balanced.write(balanced, [
        Slice.create([], 8, 16),
        Slice.create([], 16, 28),
      ])
      assert.deepEqual(leaves, [
        {
          id: 3,
          content: Slice.create([], 8, 16),
        },
        {
          id: 4,
          content: Slice.create([], 16, 28),
        },
      ])

      assert.deepEqual(nodes, [
        {
          id: 5,
          children: [1, 2, 3],
          metadata: undefined,
        },
      ])

      balanced = layout
    }

    {
      const { root, nodes, leaves } = Balanced.close(balanced, {})
      assert.deepEqual(leaves, [])
      assert.deepEqual(nodes, [
        {
          id: 6,
          children: [4],
          metadata: undefined,
        },
      ])

      assert.deepEqual(root, {
        id: 7,
        children: [5, 6],
        metadata: {},
      })
    }
  })
})
