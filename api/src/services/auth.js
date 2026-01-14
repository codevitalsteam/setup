import { prisma } from "../../lib/prisma.js";
import { sha256 } from "../../lib/customCrypto.js";

export async function requireProjectAuth(req, res, next) {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const { projectId } = req.body || {};

    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "project not found" });

    if (!token || sha256(token) !== project.apiTokenHash) {
      return res.status(401).json({ error: "unauthorized" });
    }

    req.project = project;
    next();
  } catch (e) {
    next(e);
  }
}
