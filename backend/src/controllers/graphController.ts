import { Request, Response } from "express";
import { GraphNode } from "../models/GraphNode";
import { GraphEdge } from "../models/GraphEdge";

async function loadNodes() {
  const nodes = await GraphNode.find().sort({ createdAt: 1, nodeId: 1 }).lean();
  return nodes.map((n: any) => ({
    id: n.nodeId,
    coordinate: n.coordinate,
    type: n.type,
    connectedPaths: n.connectedPaths,
  }));
}

async function loadEdges() {
  const edges = await GraphEdge.find().lean();
  return edges.map((e: any) => ({
    from: e.from,
    to: e.to,
    type: e.type,
    distance: e.distance,
    pathId: e.pathId,
    coordinates: e.coordinates,
  }));
}

export async function getGraph(_req: Request, res: Response): Promise<void> {
  try {
    const [nodes, edges] = await Promise.all([loadNodes(), loadEdges()]);
    res.json({ nodes, edges });
  } catch (error) {
    console.error("getGraph failed:", error);
    res.status(500).json({ error: "Failed to load graph." });
  }
}

export async function getGraphNodes(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await loadNodes());
  } catch (error) {
    console.error("getGraphNodes failed:", error);
    res.status(500).json({ error: "Failed to load graph nodes." });
  }
}

export async function getGraphEdges(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await loadEdges());
  } catch (error) {
    console.error("getGraphEdges failed:", error);
    res.status(500).json({ error: "Failed to load graph edges." });
  }
}