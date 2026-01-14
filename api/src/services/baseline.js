import { prisma } from "../../lib/prisma.js";

// v1 baseline rule: latest run on main
export async function getLatestMainRun(projectId) {
  return prisma.run.findFirst({
    where: { projectId, ref: { contains: "refs/heads/main" } },
    orderBy: { createdAt: "desc" }
  });
}

export async function getBaselineForRoute({ projectId, baselineRunId, route }) {
  return prisma.audit.findFirst({
    where: { projectId, runId: baselineRunId, route },
    orderBy: { createdAt: "desc" }
  });
}
