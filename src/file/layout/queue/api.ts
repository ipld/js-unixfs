import type { Branch, Link, NodeID } from "../api.js"

export interface LinkedNode {
  id: NodeID
  links: Link[]
}

export interface Queue {
  /**
   * Maps link IDs to the node IDs that need them.
   */
  needs: Record<NodeID, NodeID>
  /**
   * Maps node IDs to the Nodes & a number of links it awaits on.
   */
  nodes: Record<NodeID, { children: NodeID[]; count: number }>

  // Available links
  links: Record<NodeID, Link>

  // List of file nodes that are ready.
  linked?: LinkedNode[]
}

export interface Result extends Queue {
  // List of file nodes that are ready.
  linked: LinkedNode[]
}

export type { Link, Branch as Node, NodeID }
