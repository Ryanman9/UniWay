import { Router } from "express";
import {
  getGraph,
  getGraphNodes,
  getGraphEdges,
} from "../controllers/graphController";

const router = Router();

router.get("/", getGraph);
router.get("/nodes", getGraphNodes);
router.get("/edges", getGraphEdges);

export default router;