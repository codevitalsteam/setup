import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const HOST = process.env.HOST;
const LH_ROUTES = process.env.LH_ROUTES;
const SEO_ROUTES = process.env.SEO_ROUTES;
const USER_AGENT = process.env.USER_AGENT || "CodeVitalsBot/1.0";
const PRESETS = process.env.PRESETS || "mobile,desktop";
const SITEMAP = process.env.SITEMAP || "sitemap.xml";
const WORKSPACE = process.env.GITHUB_WORKSPACE || process.cwd();
// if env provided is relative, resolve it to WORKSPACE
const ARTIFACTS_DIR_RAW = process.env.ARTIFACTS_DIR || "artifacts";
const ARTIFACTS_DIR = path.isAbsolute(ARTIFACTS_DIR_RAW)
  ? ARTIFACTS_DIR_RAW
  : path.resolve(WORKSPACE, ARTIFACTS_DIR_RAW);

// New: consumer-provided file paths (relative to the consumer repo root)
const CONFIG_PATH = process.env.CONFIG_PATH || "configs/config.js";
const ROUTES_PATH = process.env.ROUTES_PATH || "configs/routes.js";

if (!HOST) {
  console.error("Missing env HOST (e.g. https://www.example.com)");
  process.exit(1);
}


const OVERRIDES_DIR = path.resolve(WORKSPACE, ".codevitals-overrides");

function copyFromConsumer(label, relOrAbsPath) {
  if (!relOrAbsPath) return "";

  const src = path.isAbsolute(relOrAbsPath)
    ? relOrAbsPath
    : path.resolve(WORKSPACE, relOrAbsPath);

  if (!fs.existsSync(src)) {
    console.error(`${label} not found: ${src}`);
    process.exit(1);
  }

  fs.mkdirSync(OVERRIDES_DIR, { recursive: true });
  const dest = path.join(OVERRIDES_DIR, path.basename(src));
  fs.copyFileSync(src, dest);

  return dest;
}

const OVERRIDE_CONFIG_FILE = copyFromConsumer("Consumer config", CONFIG_PATH);
const OVERRIDE_ROUTES_FILE = copyFromConsumer("Consumer routes", ROUTES_PATH);
console.log(`Using overrides dir: ${OVERRIDE_ROUTES_FILE}`);

function run(tool) {
  const result = spawnSync("node", [tool], {
    stdio: "inherit",
    env: {
      ...process.env,
      HOST,
      LH_ROUTES,
      SEO_ROUTES,
      USER_AGENT,
      PRESETS,
      SITEMAP,
      CONFIG_FILE: OVERRIDE_CONFIG_FILE,
      ROUTES_FILE: OVERRIDE_ROUTES_FILE,
      ARTIFACTS_DIR,
    },
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

// 1) Lighthouse
run("tools/lighthouse/run.mjs");

// 2) SEO Audit
run("tools/seo/run.mjs");

// 3) Screaming Frog (optional)
// run("tools/screamingfrog/run.mjs");

run("tools/utils/buildReportSummary.mjs");
