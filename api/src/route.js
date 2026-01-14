import { Router } from "express";
import { upsertProject } from "./services/project.js";
import { createRunWithAudits, computeBaselinesAndAlerts } from "./services/run.js";
import { requireProjectAuth } from "./services/auth.js";

export const router = Router();

router.post("/v1/projects", async (req, res, next) => {
  try {
    const project = await upsertProject(req.body || {});
    res.json({ ok: true, projectId: project.id });
  } catch (e) {
    next(e);
  }
});

router.get("/health", async (req, res, next) => {
  try {
    res.json({ ok: true});
  } catch (e) {
    next(e);
  }
});

router.post("/v1/runs", requireProjectAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const run = await createRunWithAudits({
      projectId: body.projectId,
      source: body.source,
      config: body.config,
      results: body.results
    });

    const { baselines, alerts, shouldAlert } = await computeBaselinesAndAlerts({
      projectId: body.projectId,
      results: body.results,
      config: body.config
    });

    res.json({ runKey: run.id, baselines, alerts, shouldAlert });
  } catch (e) {
    next(e);
  }
});