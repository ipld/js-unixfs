/* eslint-env mocha */
import { assert } from "chai"
import * as Trickle from "../../../src/file/layout/trickle.js"
import * as Slice from "../../../src/file/chunker/buffer.js"

describe("trickle layout", () => {
  it("empty produces empty leaf node", () => {
    const layout = Trickle.open()
    const { root, ...rest } = Trickle.close(layout, {})
    assert.deepEqual(root, {
      id: 1,
      metadata: {},
    })
    assert.deepEqual(rest, { nodes: [], leaves: [] })
  })

  it("write empty chunks", () => {
    let state = Trickle.open()
    {
      const { layout, nodes, leaves } = Trickle.write(state, [
        Slice.empty(),
        Slice.create([], 100, 0),
      ])
      assert.deepEqual(nodes, [])
      assert.deepEqual(leaves, [])
      state = layout
    }

    {
      const { root, leaves, nodes } = Trickle.close(state, {})
      assert.deepEqual(root, {
        id: 1,
        metadata: {},
      })
      assert.deepEqual({ leaves, nodes }, { nodes: [], leaves: [] })
    }
  })

  it("single leaf still produces root", () => {
    let state = Trickle.open()
    {
      const { nodes, leaves, layout } = Trickle.write(state, [
        Slice.create([], 0, 4),
      ])
      assert.deepEqual(leaves, [
        {
          id: 1,
          content: Slice.create([], 0, 4),
        },
      ])
      assert.deepEqual(nodes, [])
      state = layout
    }

    {
      const { root, nodes, leaves } = Trickle.close(state, {})
      assert.deepEqual(root, {
        id: 2,
        children: [1],
        metadata: {},
      })
      assert.deepEqual({ nodes, leaves }, { nodes: [], leaves: [] })
    }
  })

  // it("two leaves produce a root", () => {
  //   const { nodes, leaves, layout } = Balanced.write(
  //     Balanced.open(Balanced.options),
  //     [Slice.create([], 0, 4), Slice.create([], 4, 8)]
  //   )
  //   assert.deepEqual(nodes, [])
  //   assert.deepEqual(leaves, [
  //     {
  //       id: 1,
  //       content: Slice.create([], 0, 4),
  //     },
  //     {
  //       id: 2,
  //       content: Slice.create([], 4, 8),
  //     },
  //   ])

  //   const { root, ...rest } = Balanced.close(layout)
  //   assert.deepEqual(root, {
  //     id: 3,
  //     children: [1, 2],
  //     metadata: undefined,
  //   })

  //   assert.deepEqual(rest, { nodes: [], leaves: [] })
  // })

  // it("overflows into second node", () => {
  //   let balanced = Balanced.open({ width: 3 })
  //   {
  //     const { nodes, leaves, layout } = Balanced.write(balanced, [
  //       Slice.create([], 0, 4),
  //       Slice.create([], 4, 8),
  //     ])
  //     assert.deepEqual(nodes, [])
  //     assert.deepEqual(leaves, [
  //       {
  //         id: 1,
  //         content: Slice.create([], 0, 4),
  //       },
  //       {
  //         id: 2,
  //         content: Slice.create([], 4, 8),
  //       },
  //     ])

  //     balanced = layout
  //   }

  //   {
  //     const { nodes, leaves, layout } = Balanced.write(balanced, [
  //       Slice.create([], 8, 16),
  //       Slice.create([], 16, 28),
  //     ])
  //     assert.deepEqual(leaves, [
  //       {
  //         id: 3,
  //         content: Slice.create([], 8, 16),
  //       },
  //       {
  //         id: 4,
  //         content: Slice.create([], 16, 28),
  //       },
  //     ])

  //     assert.deepEqual(nodes, [
  //       {
  //         id: 5,
  //         children: [1, 2, 3],
  //         metadata: undefined,
  //       },
  //     ])

  //     balanced = layout
  //   }

  //   {
  //     const { root, nodes, leaves } = Balanced.close(balanced, {})
  //     assert.deepEqual(leaves, [])
  //     assert.deepEqual(nodes, [
  //       {
  //         id: 6,
  //         children: [4],
  //         metadata: undefined,
  //       },
  //     ])

  //     assert.deepEqual(root, {
  //       id: 7,
  //       children: [5, 6],
  //       metadata: {},
  //     })
  //   }
  // })
})
