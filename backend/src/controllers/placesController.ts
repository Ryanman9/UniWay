import { Request, Response } from "express";
import { Place } from "../models/Place";
import { PlaceDetails } from "../models/PlaceDetails";

function toFeature(place: any) {
  const properties: Record<string, any> = {
    id: place.placeId,
    name: place.name,
    type: place.type,
  };

  if (place.markerColor) properties["marker-color"] = place.markerColor;
  if (place.markerSize) properties["marker-size"] = place.markerSize;
  if (place.markerSymbol) properties["marker-symbol"] = place.markerSymbol;

  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: place.location.coordinates,
    },
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPlaces(req: Request, res: Response): Promise<void> {
  try {
    const filter: Record<string, any> = {};

    if (typeof req.query.type === "string" && req.query.type) {
      filter.type = req.query.type;
    }

    if (typeof req.query.q === "string" && req.query.q.trim()) {
      filter.name = { $regex: escapeRegex(req.query.q.trim()), $options: "i" };
    }

    const places = await Place.find(filter).sort({ name: 1 }).lean();

    res.json({
      type: "FeatureCollection",
      features: places.map(toFeature),
    });
  } catch (error) {
    console.error("listPlaces failed:", error);
    res.status(500).json({ error: "Failed to load places." });
  }
}

export async function getPlace(req: Request, res: Response): Promise<void> {
  try {
    const place = await Place.findOne({ placeId: req.params.placeId }).lean();

    if (!place) {
      res.status(404).json({ error: "Place not found." });
      return;
    }

    const details = await PlaceDetails.findOne({ placeId: place.placeId })
      .select("-_id -__v -createdAt -updatedAt")
      .lean();

    res.json({
      place: toFeature(place),
      details: details ?? null,
    });
  } catch (error) {
    console.error("getPlace failed:", error);
    res.status(500).json({ error: "Failed to load place." });
  }
}