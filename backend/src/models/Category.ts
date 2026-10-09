import { Schema, model, InferSchemaType } from "mongoose";

const categorySchema = new Schema(
  {
    categoryId: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true },
    icon: { type: String },
  },
  { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export const Category = model("Category", categorySchema);