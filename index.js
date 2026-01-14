import { spawnSync } from "node:child_process";
import process from "node:process";

// GitHub Actions passes inputs as env vars named INPUT_<NAME_IN_ACTION_YML>, uppercased and _ for dashes.
const HOST = process.env.INPUT_HOST;
const LH_ROUTES = process.env.INPUT_ROUTES;
const USER_AGENT = process.env.INPUT_USER_AGENT;
const PRESETS = process.env.INPUT_PRESETS;

function run(tool) {
  spawnSync("node", [tool],
    { 
      stdio: "inherit", 
      env: {
        ...process.env,
        HOST,
        LH_ROUTES,
        USER_AGENT,
        PRESETS,
      },
    });
}

const host = process.env.HOST;
if (!host) {
  console.error("Missing env HOST (e.g. https://www.example.com:443)");
  process.exit(1);
}

// 1) SEO Audit
run("tools/seo/run.mjs");

// 2) Lighthouse (your existing runner)
run("tools/lighthouse/run.mjs");

// 3) Screaming Frog Crawl
//run("tools/screamingfrog/run.mjs");