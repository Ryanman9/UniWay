import { Request, Response } from "express";
import { Category } from "../models/Category";

export async function listCategories(_req: Request, res: Response): Promise<void> {
  try {
    const categories = await Category.find().sort({ label: 1 }).lean();

    res.json(
      categories.map((c: any) => ({
        id: c.categoryId,
        label: c.label,
        icon: c.icon,
      }))
    );
  } catch (error) {
    console.error("listCategories failed:", error);
    res.status(500).json({ error: "Failed to load categories." });
  }
}