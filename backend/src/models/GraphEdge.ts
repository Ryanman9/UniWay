import { Schema, model, InferSchemaType } from "mongoose";

const graphEdgeSchema = new Schema(
  {
    from: { type: String, required: true, index: true },
    to: { type: String, required: true, index: true },
    type: { type: String, enum: ["pedestrian", "vehicle"], required: true },
    distance: { type: Number, required: true },
    pathId: { type: String },
    coordinates: { type: [[Number]], required: true },
  },
  { timestamps: true }
);

export type GraphEdgeDoc = InferSchemaType<typeof graphEdgeSchema>;
export const GraphEdge = model("GraphEdge", graphEdgeSchema);