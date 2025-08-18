import { Router } from "express";
const router = Router();

// GET /api/health
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "cresceja-backend",
    uptime: process.uptime(),
    time: new Date().toISOString(),
  });
});

export default router;



