// Topological sort for task dependency graphs.
// Used by the agent team to determine execution order of agent tasks.

export type DependencyGraph = Map<string, string[]>

/**
 * Performs a topological sort on a dependency graph using Kahn's algorithm.
 * Returns tasks in execution order (dependencies before dependents).
 * Throws if a cycle is detected.
 */
export function topologicalSort(graph: DependencyGraph): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // Initialize all nodes
  for (const [node, deps] of graph) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0)
    }
    for (const dep of deps) {
      // dep must be completed before node
      if (!inDegree.has(dep)) {
        inDegree.set(dep, 0)
      }
      inDegree.set(node, (inDegree.get(node) ?? 0) + 1)

      // Add adjacency: dep -> node
      const existing = adjacency.get(dep) ?? []
      existing.push(node)
      adjacency.set(dep, existing)
    }
  }

  // Start with nodes that have no dependencies
  const queue: string[] = []
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node)
    }
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const node = queue.shift()!
    sorted.push(node)

    const neighbors = adjacency.get(node) ?? []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (sorted.length !== inDegree.size) {
    throw new Error("Dependency graph contains a cycle")
  }

  return sorted
}

/**
 * Groups tasks into parallelism waves.
 * Each wave contains tasks that can execute concurrently.
 */
export function parallelismWaves(graph: DependencyGraph): string[][] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const [node, deps] of graph) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0)
    }
    for (const dep of deps) {
      if (!inDegree.has(dep)) {
        inDegree.set(dep, 0)
      }
      inDegree.set(node, (inDegree.get(node) ?? 0) + 1)
      const existing = adjacency.get(dep) ?? []
      existing.push(node)
      adjacency.set(dep, existing)
    }
  }

  const waves: string[][] = []
  const completed = new Set<string>()

  while (completed.size < inDegree.size) {
    const wave: string[] = []
    for (const [node, degree] of inDegree) {
      if (!completed.has(node) && degree === 0) {
        wave.push(node)
      }
    }

    if (wave.length === 0) {
      throw new Error("Dependency graph contains a cycle")
    }

    waves.push(wave)
    for (const node of wave) {
      completed.add(node)
      const neighbors = adjacency.get(node) ?? []
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1)
      }
    }
  }

  return waves
}
