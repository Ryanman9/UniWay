import { Schema, model, InferSchemaType } from "mongoose";

const graphNodeSchema = new Schema(
  {
    nodeId: { type: String, required: true, unique: true, index: true },
    coordinate: { type: [Number], required: true },
    type: {
      type: String,
      enum: ["endpoint", "intersection", "intersection_endpoint"],
      required: true,
    },
    connectedPaths: { type: [String], default: [] },
  },
  { timestamps: true }
);

export type GraphNodeDoc = InferSchemaType<typeof graphNodeSchema>;
export const GraphNode = model("GraphNode", graphNodeSchema);