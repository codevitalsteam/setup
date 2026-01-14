import { prisma } from "../../lib/prisma.js";
import { getLatestMainRun, getBaselineForRoute } from "./baseline.js";

export async function createRunWithAudits({ projectId, source, config, results }) {
  if (!Array.isArray(results) || results.length === 0) {
    const err = new Error("results[] required");
    err.status = 400;
    throw err;
  }

  const run = await prisma.$transaction(async (tx) => {
    const runRow = await tx.run.create({
      data: {
        projectId,
        provider: source?.provider ?? "github",
        repo: source?.repo ?? null,
        ref: source?.ref ?? null,
        sha: source?.sha ?? null,
        workflow: source?.workflow ?? null,
        runId: source?.runId ? String(source.runId) : null,
        runAttempt: source?.runAttempt ?? null,
        prNumber: source?.prNumber ?? null,
        configJson: config ?? null
      }
    });

    for (const r of results) {
      await tx.audit.create({
        data: {
          runId: runRow.id,
          projectId,
          route: r.route,
          url: r.url,
          seo: r.scores?.seo ?? 0,
          performance: r.scores?.performance ?? 0,
          accessibility: r.scores?.accessibility ?? 0,
          bestPractices: r.scores?.bestPractices ?? 0,
          fcpMs: r.timing?.fcpMs ?? null,
          lcpMs: r.timing?.lcpMs ?? null,
          cls: r.timing?.cls ?? null,
          auditsJson: r.audits ?? null
        }
      });
    }

    return runRow;
  });

  return run;
}

export async function computeBaselinesAndAlerts({ projectId, results, config }) {
  const latestMainRun = await getLatestMainRun(projectId);

  const baselines = [];
  if (latestMainRun) {
    for (const r of results) {
      const baselineAudit = await getBaselineForRoute({
        projectId,
        baselineRunId: latestMainRun.id,
        route: r.route
      });

      if (!baselineAudit) continue;

      baselines.push({
        route: r.route,
        baseline: { seo: baselineAudit.seo, performance: baselineAudit.performance },
        delta: {
          seo: (r.scores?.seo ?? 0) - baselineAudit.seo,
          performance: (r.scores?.performance ?? 0) - baselineAudit.performance
        }
      });
    }
  }

  const maxSeoDrop = config?.budgets?.maxSeoDrop ?? 0;
  const alerts = [];

  if (maxSeoDrop > 0) {
    for (const b of baselines) {
      if (typeof b.delta.seo === "number" && b.delta.seo < -maxSeoDrop) {
        alerts.push({ type: "seo_regression", route: b.route, delta: b.delta.seo, severity: "warning" });
      }
    }
  }

  return { baselines, alerts, shouldAlert: alerts.length > 0 };
}
