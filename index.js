import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

// GitHub Actions passes inputs as env vars named INPUT_<NAME_IN_ACTION_YML>, uppercased and _ for dashes.
const HOST = process.env.INPUT_HOST;
const LH_ROUTES = process.env.INPUT_ROUTES;
const USER_AGENT = process.env.INPUT_USER_AGENT;
const PRESETS = process.env.INPUT_PRESETS;
const actionRoot = process.env.GITHUB_ACTION_PATH;

if (!actionRoot) {
  console.error("Missing GITHUB_ACTION_PATH. This script must run inside a GitHub Action.");
  process.exit(1);
}

if (!HOST) {
  console.error("Missing required input: host (maps to process.env.INPUT_HOST)");
  process.exit(1);
}

function run(relativeToolPath) {
  const toolAbsPath = path.resolve(actionRoot, relativeToolPath);

  if (!fs.existsSync(toolAbsPath)) {
    console.error(`Tool not found: ${toolAbsPath}`);
    console.error(`actionRoot: ${actionRoot}`);
    process.exit(1);
  }

  const result = spawnSync("node", [toolAbsPath], {
    stdio: "inherit",
    cwd: actionRoot, // ✅ ensures tools can resolve their own relative paths from the action repo
    env: {
      ...process.env,
      HOST,
      LH_ROUTES,
      USER_AGENT,
      PRESETS,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// 1) SEO Audit
run("tools/seo/run.mjs");

// 2) Lighthouse (your existing runner)
run("tools/lighthouse/run.mjs");

// 3) Screaming Frog Crawl
// run("tools/screamingfrog/run.mjs");
