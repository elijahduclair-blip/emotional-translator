export function getRuntimeMetrics(graph = {}) {
  const mem = process.memoryUsage();

  return {
    time: new Date().toISOString(),

    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
    },

    graph: {
      nodes: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
      edges: Array.isArray(graph.edges) ? graph.edges.length : 0,
      activeRoutes: Array.isArray(graph.activeRoutes)
        ? graph.activeRoutes.length
        : 0
    }
  };
}

export function logRuntimeMetrics(graph = {}) {
  console.log(
    "[ENGINE METRICS]",
    JSON.stringify(getRuntimeMetrics(graph), null, 2)
  );
}