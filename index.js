import { spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ✅ Action root derived from *this file’s location* (works even if GITHUB_ACTION_PATH is missing)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const actionRoot = __dirname; // index.js is at repo root

console.log("GITHUB_ACTION:", process.env.GITHUB_ACTION);
console.log("GITHUB_ACTION_PATH:", process.env.GITHUB_ACTION_PATH);
console.log("Derived actionRoot:", actionRoot);
console.log("INPUT_HOST:", process.env.INPUT_HOST);
console.log(
  "INPUT_* keys:",
  Object.keys(process.env).filter((k) => k.startsWith("INPUT_"))
);

// Inputs
const HOST = process.env.INPUT_HOST;
const LH_ROUTES = process.env.INPUT_ROUTES;
const USER_AGENT = process.env.INPUT_USER_AGENT;
const PRESETS = process.env.INPUT_PRESETS;

function run(relativeToolPath) {
  const toolAbsPath = path.resolve(actionRoot, relativeToolPath);

  if (!fs.existsSync(toolAbsPath)) {
    console.error(`Tool not found: ${toolAbsPath}`);
    console.error(`actionRoot: ${actionRoot}`);
    process.exit(1);
  }

  const result = spawnSync("node", [toolAbsPath], {
    stdio: "inherit",
    cwd: actionRoot, // ✅ important: tools resolve relative paths from the action repo
    env: {
      ...process.env,
      HOST,
      LH_ROUTES,
      USER_AGENT,
      PRESETS,
    },
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!HOST) {
  console.error("Missing required input: host (process.env.INPUT_HOST)");
  process.exit(1);
}

// 1) SEO Audit
run("tools/seo/run.mjs");

// 2) Lighthouse
run("tools/lighthouse/run.mjs");

// 3) Screaming Frog
// run("tools/screamingfrog/run.mjs");
