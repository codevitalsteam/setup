import { prisma } from "../../lib/prisma.js";
import { sha256 } from "../../lib/customCrypto.js";

export async function upsertProject({ projectId, name, apiToken }) {
  if (!projectId || !apiToken) {
    const err = new Error("projectId & apiToken required");
    err.status = 400;
    throw err;
  }

  return prisma.project.upsert({
    where: { id: projectId },
    update: { name: name ?? null, apiTokenHash: sha256(apiToken) },
    create: { id: projectId, name: name ?? null, apiTokenHash: sha256(apiToken) }
  });
}
