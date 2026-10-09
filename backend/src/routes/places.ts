import { Router } from "express";
import { listPlaces, getPlace } from "../controllers/placesController";

const router = Router();

router.get("/", listPlaces);
router.get("/:placeId", getPlace);

export default router;