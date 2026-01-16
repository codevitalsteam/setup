import { spawnSync } from "node:child_process";
import process from "node:process";

const HOST = process.env.HOST;
const LH_ROUTES = process.env.LH_ROUTES || "/";
const USER_AGENT = process.env.USER_AGENT || "CodeVitalsBot/1.0";
const PRESETS = process.env.PRESETS || "mobile,desktop";
const SITEMAP = process.env.SITEMAP || "sitemap.xml";

if (!HOST) {
  console.error("Missing env HOST (e.g. https://www.example.com)");
  process.exit(1);
}

function run(tool) {
  const result = spawnSync("node", [tool], {
    stdio: "inherit",
    env: {
      ...process.env,
      HOST,
      LH_ROUTES,
      USER_AGENT,
      PRESETS,
      SITEMAP,
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
