/* eslint-env mocha */
import { expect, assert } from "chai"
import * as Queue from "../../../src/file/layout/queue.js"
import * as UnixFS from "../../../src/unixfs.js"
import { shuffle, createLink, createNode } from "./util.js"

describe("layout queue", () => {
  it("empty is linked right away", () => {
    const v0 = Queue.empty()
    const v1 = Queue.addNode(
      {
        id: 0,
        children: [],
      },
      v0
    )

    assert.deepEqual(v1, {
      mutable: false,
      needs: {},
      links: {},
      nodes: {},
      linked: [createNode(0, [])],
    })
  })

  it("has only one link", () => {
    const v0 = Queue.empty()
    const v1 = Queue.addLink(1, createLink("a"), v0)

    const v2 = Queue.addNode(
      {
        id: 0,
        children: [1],
      },
      v1
    )

    assert.deepEqual(v2, {
      mutable: false,
      needs: {},
      links: {},
      nodes: {},
      linked: [createNode(0, [createLink("a")])],
    })
  })

  it("has several links", () => {
    const v0 = Queue.addLinks(
      [
        [1, createLink("a")],
        [2, createLink("b")],
        [3, createLink("c")],
      ],
      Queue.empty()
    )

    const v1 = Queue.addNode(
      {
        id: 0,
        children: [1, 2, 3],
      },
      v0
    )

    assert.deepEqual(v1, {
      mutable: false,
      needs: {},
      links: {},
      nodes: {},
      linked: [
        createNode(0, [createLink("a"), createLink("b"), createLink("c")]),
      ],
    })
  })

  it("needs first child", () => {
    const v0 = Queue.empty()

    const v1 = Queue.addNode(
      {
        id: 0,
        children: [1],
      },
      v0
    )

    assert.deepEqual(
      v1,
      {
        mutable: false,
        needs: { [1]: 0 },
        links: {},
        nodes: { [0]: { count: 1, children: [1] } },
        linked: [],
      },
      "adds node to the queue"
    )

    const v2 = Queue.addLink(1, createLink("foo"), v1)

    assert.deepEqual(
      v2,
      {
        mutable: false,
        needs: {},
        links: {},
        nodes: {},
        linked: [createNode(0, [createLink("foo")])],
      },
      "moves node to the ready list"
    )
  })

  it("queu then link", () => {
    const v0 = Queue.addLinks(
      [
        [2, createLink("b")],
        [4, createLink("d")],
      ],
      Queue.empty()
    )

    const v1 = Queue.addNode(
      {
        id: 9,
        children: [1, 2, 3, 4, 5],
      },
      v0
    )

    assert.deepEqual(
      v1,
      {
        mutable: false,
        needs: { [1]: 9, [3]: 9, [5]: 9 },
        links: {
          [2]: createLink("b"),
          [4]: createLink("d"),
        },
        nodes: {
          [9]: {
            count: 3,
            children: [1, 2, 3, 4, 5],
          },
        },
        linked: [],
      },
      "adds node to the queue"
    )

    const v2 = Queue.addLink(1, createLink("a"), v1)

    assert.deepEqual(
      v2,
      {
        mutable: false,
        needs: { [3]: 9, [5]: 9 },
        links: {
          [1]: createLink("a"),
          [2]: createLink("b"),
          [4]: createLink("d"),
        },
        nodes: {
          [9]: {
            count: 2,
            children: [1, 2, 3, 4, 5],
          },
        },
        linked: [],
      },
      "removes first depedency"
    )

    const v3 = Queue.addLink(5, createLink("e"), v2)

    assert.deepEqual(
      v3,
      {
        mutable: false,
        needs: { [3]: 9 },
        links: {
          [1]: createLink("a"),
          [2]: createLink("b"),
          [4]: createLink("d"),
          [5]: createLink("e"),
        },
        nodes: {
          [9]: {
            count: 1,
            children: [1, 2, 3, 4, 5],
          },
        },
        linked: [],
      },
      "removes last depedency"
    )

    const v4 = Queue.addLink(3, createLink("c"), v3)

    assert.deepEqual(
      v4,
      {
        mutable: false,
        needs: {},
        links: {},
        nodes: {},
        linked: [
          createNode(9, [
            createLink("a"),
            createLink("b"),
            createLink("c"),
            createLink("d"),
            createLink("e"),
          ]),
        ],
      },
      "moves to linked"
    )
  })

  it("links ahead", () => {
    const v0 = Queue.addLinks(
      [
        [2, createLink("b")],
        [5, createLink("d")],
      ],
      Queue.empty()
    )

    const v1 = Queue.addNode(
      {
        id: 9,
        children: [1, 2, 3, 5, 4],
      },
      v0
    )

    assert.deepEqual(
      v1,
      {
        mutable: false,
        needs: { [1]: 9, [3]: 9, [4]: 9 },
        links: {
          [2]: createLink("b"),
          [5]: createLink("d"),
        },
        nodes: {
          [9]: {
            count: 3,
            children: [1, 2, 3, 5, 4],
          },
        },
        linked: [],
      },
      "adds node to the queue"
    )

    const v2 = Queue.addLink(1, createLink("a"), v1)

    assert.deepEqual(
      v2,
      {
        mutable: false,
        needs: { [3]: 9, [4]: 9 },
        links: {
          [1]: createLink("a"),
          [2]: createLink("b"),
          [5]: createLink("d"),
        },
        nodes: {
          [9]: {
            count: 2,
            children: [1, 2, 3, 5, 4],
          },
        },
        linked: [],
      },
      "removes first depedency"
    )

    const v3 = Queue.addLink(4, createLink("e"), v2)

    assert.deepEqual(
      v3,
      {
        mutable: false,
        needs: { [3]: 9 },
        links: {
          [1]: createLink("a"),
          [2]: createLink("b"),
          [4]: createLink("e"),
          [5]: createLink("d"),
        },
        nodes: {
          [9]: {
            count: 1,
            children: [1, 2, 3, 5, 4],
          },
        },
        linked: [],
      },
      "removes last depedency"
    )

    const v4 = Queue.addLink(3, createLink("c"), v3)

    assert.deepEqual(
      v4,
      {
        mutable: false,
        needs: {},
        links: {},
        nodes: {},
        linked: [
          createNode(9, [
            createLink("a"),
            createLink("b"),
            createLink("c"),
            createLink("d"),
            createLink("e"),
          ]),
        ],
      },
      "moves to linked"
    )
  })
})

describe("random operation order", () => {
  /** @type {Array<{type:"addNode", node: Queue.Node}|{type:"addLink", id:number, link:Queue.Link}>} */
  const ops = [
    {
      type: "addNode",
      node: {
        id: 9,
        children: [1, 2, 3, 4, 5],
      },
    },
    {
      type: "addLink",
      id: 1,
      link: createLink("a"),
    },
    {
      type: "addLink",
      id: 2,
      link: createLink("b"),
    },
    {
      type: "addLink",
      id: 3,
      link: createLink("c"),
    },
    {
      type: "addLink",
      id: 4,
      link: createLink("d"),
    },
    {
      type: "addLink",
      id: 5,
      link: createLink("e"),
    },
    {
      type: "addNode",
      node: {
        id: 7,
        children: [6],
      },
    },
    {
      type: "addLink",
      id: 6,
      link: createLink("f"),
    },
    {
      type: "addNode",
      node: {
        id: 0,
        children: [8, 9, 10, 11],
      },
    },
    {
      type: "addLink",
      id: 8,
      link: createLink("g"),
    },
    {
      type: "addLink",
      id: 9,
      link: createLink("h"),
    },
    {
      type: "addLink",
      id: 10,
      link: createLink("M"),
    },
    {
      type: "addLink",
      id: 11,
      link: createLink("n"),
    },
  ]

  for (const order of shuffle(ops)) {
    const title = `${order
      .map(op =>
        op.type === "addLink"
          ? `addLink(${op.id})`
          : `addNode(${String(op.node.id)})`
      )
      .join(".")}`

    it(title, () => {
      let queue = Queue.empty()
      for (const op of order) {
        queue =
          op.type === "addLink"
            ? Queue.addLink(op.id, op.link, queue)
            : Queue.addNode(op.node, queue)
      }

      assert.deepEqual(
        { ...queue, linked: [] },
        {
          mutable: false,
          needs: {},
          links: {},
          nodes: {},
          linked: [],
        }
      )

      const expectedLinks = [
        createNode(9, [
          createLink("a"),
          createLink("b"),
          createLink("c"),
          createLink("d"),
          createLink("e"),
        ]),
        createNode(7, [createLink("f")]),
        createNode(0, [
          createLink("g"),
          createLink("h"),
          createLink("M"),
          createLink("n"),
        ]),
      ]

      assert.deepEqual(
        [...queue.linked].sort((a, b) => a.links.length - b.links.length),
        expectedLinks.sort((a, b) => a.links.length - b.links.length)
      )
    })
  }
})
