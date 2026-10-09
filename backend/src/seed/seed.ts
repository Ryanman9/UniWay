import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import { connectDB } from "../config/db";
import { Place } from "../models/Place";
import { GraphNode } from "../models/GraphNode";
import { GraphEdge } from "../models/GraphEdge";
import { Category } from "../models/Category";
import { buildNodes, buildEdges } from "./graphBuilder";

const DATA_DIR = path.resolve(__dirname, "../../../frontend/www/data");

const CATEGORY_LABELS: Record<string, string> = {
  academic: "Academic",
  office: "Offices",
  cultural: "Cultural",
  sports: "Sports",
  gate: "Gates",
};

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

async function seed(): Promise<void> {
  const pois = readJson("pois.json");
  const paths = readJson("paths.json");

  await connectDB();

  const places = pois.features.map((f: any) => ({
    placeId: f.properties.id,
    name: f.properties.name,
    type: f.properties.type,
    markerColor: f.properties["marker-color"],
    markerSize: f.properties["marker-size"],
    markerSymbol: f.properties["marker-symbol"],
    location: { type: "Point", coordinates: f.geometry.coordinates },
  }));

  const nodes = buildNodes(paths);
  const edges = buildEdges(paths, nodes);

  const categoryIds = [...new Set<string>(places.map((p: any) => p.type))];
  const categories = categoryIds.map((id) => ({
    categoryId: id,
    label: CATEGORY_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1),
  }));

  await Promise.all([
    Place.deleteMany({}),
    GraphNode.deleteMany({}),
    GraphEdge.deleteMany({}),
    Category.deleteMany({}),
  ]);

  await Place.insertMany(places);
  await GraphNode.insertMany(nodes);
  await GraphEdge.insertMany(edges);
  await Category.insertMany(categories);

  console.log("Seed complete:");
  console.log(`  places:     ${places.length}`);
  console.log(`  graphNodes: ${nodes.length}`);
  console.log(`  graphEdges: ${edges.length}`);
  console.log(`  categories: ${categories.length}`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});