import { Schema, model, InferSchemaType } from "mongoose";

const placeSchema = new Schema(
  {
    placeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    markerColor: { type: String },
    markerSize: { type: String },
    markerSymbol: { type: String },
    location: {
      type: { type: String, enum: ["Point"], default: "Point", required: true },
      coordinates: { type: [Number], required: true },
    },
  },
  { timestamps: true }
);

placeSchema.index({ location: "2dsphere" });

export type PlaceDoc = InferSchemaType<typeof placeSchema>;
export const Place = model("Place", placeSchema);