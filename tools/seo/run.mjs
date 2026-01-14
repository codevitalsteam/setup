import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { request } from "undici";

import { seoConfig } from "./config.mjs";
import { defaultRoutes } from "./routes.mjs";
import { runSeoAudits } from "./scripts/seoAudit.js";
import { saveSeoResults } from "./scripts/saveSeoOutput.js";

export const fetchHtml = async (url) => {
  console.log(`Fetching HTML for SEO audits from ${url}... with user-agent: ${process.env.USER_AGENT || "CodeVitalsBot/1.0"}`);
  const res = await request(url, {
    method: "GET",
    headers: { "user-agent": process.env.USER_AGENT || "CodeVitalsBot/1.0" },
  });
  const html = await res.body.text();
  return { status: res.statusCode, headers: res.headers, html };
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const host = process.env.HOST;
if (!host) {
  console.error("Missing env HOST (e.g. https://www.example.com:443)");
  process.exit(1);
}

const LH_DIR = path.resolve("artifacts/lighthouse");

// SEO Audit should have it's own routes
const ROUTES = (
  process.env.LH_ROUTES ? process.env.LH_ROUTES.split(",") : defaultRoutes
)
  .map((s) => s.trim())
  .filter(Boolean);

const delayMs = Number(process.env.CRAWL_DELAY_MS ?? "0");

for (const route of ROUTES) {
  const url = `${host}${route.startsWith("/") ? route : `/${route}`}`;
  const slugBase =
    route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_+/, "");
  const lhPath = path.join(LH_DIR, `${slugBase}-desktop.json`);

  if (!fs.existsSync(lhPath)) {
    console.warn(`⚠️ Missing lighthouse file: ${lhPath} (skipping ${route})`);
    continue;
  }

  const lighthouseJson = JSON.parse(fs.readFileSync(lhPath, "utf8"));
  const lhr = lighthouseJson.lhr ?? lighthouseJson;

  console.log(`\nFetching HTML for SEO audits from ${url}...`);
  const { status, headers, html } = await fetchHtml(url);
  console.log(`Fetched HTML: status=${status}, content-type=${headers["content-type"]}`);

  const result = await runSeoAudits({
    url,
    html,
    lighthouseLhr: lhr,
    config: seoConfig,
    // pageType: "PDP",
    // isVariant: false,
    isProduction: process.env.ENVIRONMENT === "prod",
  });

  saveSeoResults({
    route: url,
    results: result,
  });

  console.dir(result, { depth: null, colors: true });

  if (delayMs > 0) await sleep(delayMs);
}

console.log("\n✅ Custom SEO checks complete");
