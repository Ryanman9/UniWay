import { Schema, model, InferSchemaType } from "mongoose";

const relatedPersonSchema = new Schema(
  {
    name: { type: String, required: true },
    relation: { type: String, required: true },
  },
  { _id: false }
);

const placeDetailsSchema = new Schema(
  {
    placeId: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    history: { type: String },
    hours: { type: String },
    images: { type: [String], default: [] },
    relatedPeople: { type: [relatedPersonSchema], default: [] },
  },
  { timestamps: true }
);

export type PlaceDetailsDoc = InferSchemaType<typeof placeDetailsSchema>;
export const PlaceDetails = model("PlaceDetails", placeDetailsSchema);