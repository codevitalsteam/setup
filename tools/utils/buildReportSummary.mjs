// scripts/build-summary.mjs
import fs from "node:fs";
import path from "node:path";
import {mdBuilder} from "./mdBuilder.mjs";

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || "artifacts";
const OUT_JSON = path.join(ARTIFACTS_DIR, "summary.json");
const OUT_MD = path.join(ARTIFACTS_DIR, "summary.md");

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function formatSeoReports(file) {
  const data = safeReadJson(file);

  const reports = {}
  reports.summary = data.results.summary;
  reports.url = data.results.url;
  reports.findings = {};
  reports.findings.passed = [];
  reports.findings.failed = [];
  for (const f of data.results.findings) {
    if (f.pass) reports.findings.passed.push(f);
    else reports.findings.failed.push(f);
  }
  return reports;

}

function walk(dir) {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

// Heuristic: find lighthouse JSON reports (adjust to your actual filenames)
function findLighthouseReports() {
  const lhDir = path.join(ARTIFACTS_DIR, "lighthouse");
  const files = walk(lhDir).filter((f) => f.endsWith(".json"));
  
  console.log(`Found ${files.length} Lighthouse JSON reports under ${lhDir}`);

  return files
    .map((file) => ({ file, data: safeReadJson(file) }))
    .filter((x) => x.data && x.data.categories);
}

// Heuristic: find lighthouse JSON reports (adjust to your actual filenames)
function findSEOReports() {
  const seoDir = path.join(ARTIFACTS_DIR, "seo");
  const files = walk(seoDir).filter((f) => f.endsWith(".json"));
  
  console.log(`Found ${files.length} SEO JSON reports under ${seoDir}`);
  return files
    .map((file) => ({ file, data: formatSeoReports(file) }))
}

function toNum(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  // strip "ms", "s", commas, NBSP, etc.
  const s = String(v).replace(/[,\u00A0]/g, "").trim();
  const msMatch = s.match(/^([\d.]+)\s*ms$/i);
  if (msMatch) return Number(msMatch[1]);
  const secMatch = s.match(/^([\d.]+)\s*s$/i);
  if (secMatch) return Number(secMatch[1]) * 1000;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function score01To100(x) {
  if (x == null) return null;
  if (x > 1) return Math.round(x); // already 0-100
  return Math.round(x * 100);
}

function parseLh(report) {
  // Lighthouse report format: categories + audits
  const categories = report.categories || {};
  const audits = report.audits || {};

  const scores = {
    performance: score01To100(categories.performance?.score),
    seo: score01To100(categories.seo?.score),
    accessibility: score01To100(categories.accessibility?.score),
    bestPractices: score01To100(categories["best-practices"]?.score),
  };

  // These audit IDs are typical; adjust if your runner exports different metrics.
  const metrics = {
    fcpMs: toNum(audits["first-contentful-paint"]?.numericValue),
    lcpMs: toNum(audits["largest-contentful-paint"]?.numericValue),
    cls: toNum(audits["cumulative-layout-shift"]?.numericValue),
    tbtMs: toNum(audits["total-blocking-time"]?.numericValue),
    inpMs: toNum(audits["interaction-to-next-paint"]?.numericValue),
  };

  return { scores, metrics };
}

export const buildReportSummary = async () => {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const lhReports = findLighthouseReports();
  const seoReports = findSEOReports();
  const reports = lhReports.concat(seoReports);
  console.log("Reports:", reports);


  const items = lhReports.map(({ file, data }) => {
    const { scores, metrics } = parseLh(data);
    // Try to infer device/route from filename path
    const rel = path.relative(ARTIFACTS_DIR, file).replaceAll("\\", "/");
    return { relPath: rel, scores, metrics };
  });

  // Very simple "overall": worst perf score + worst LCP across found reports
  const perfScores = items.map((i) => i.scores.performance).filter((x) => x != null);
  const worstPerf = perfScores.length ? Math.min(...perfScores) : null;
  const lcpValues = items.map((i) => i.metrics.lcpMs).filter((x) => x != null);
  const worstLcp = lcpValues.length ? Math.max(...lcpValues) : null;

  const summary = {
    generatedAt: new Date().toISOString(),
    run: {
      host: process.env.HOST || null,
      sha: process.env.GITHUB_SHA || null,
      runId: process.env.GITHUB_RUN_ID || null,
      runNumber: process.env.GITHUB_RUN_NUMBER || null,
      serverUrl: process.env.GITHUB_SERVER_URL || "https://github.com",
      repo: process.env.GITHUB_REPOSITORY || null,
    },
    lighthouse: {
      count: items.length,
      worst: { performance: worstPerf, lcpMs: worstLcp },
      reports: items,
    },
    seo: {
      count: seoReports.length,
      reports: seoReports
      // Could add more SEO summary data here
    },
  };

  // Generate report files
  mdBuilder(summary, OUT_JSON, OUT_MD);
}

await buildReportSummary();