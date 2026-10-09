import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import placesRoutes from "./routes/places";
import graphRoutes from "./routes/graph";
import categoriesRoutes from "./routes/categories";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/places", placesRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/categories", categoriesRoutes);

async function start(): Promise<void> {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`UniWay backend listening on http://localhost:${PORT}`);
  });
}

start();