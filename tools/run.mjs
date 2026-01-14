import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

const host = process.env.HOST;
if (!host) {
  console.error("Missing env HOST (e.g. https://www.example.com:443)");
  process.exit(1);
}

// 1) SEO Audit
//run("node tools/seo/run.mjs");

// 2) Lighthouse (your existing runner)
//run("node tools/lighthouse/run.mjs");

// 3) Screaming Frog Crawl
run("node tools/screamingfrog/run.mjs");

console.log("✅ SEO run complete");
console.log(`- Lighthouse: artifacts/lighthouse (your existing output)`);
console.log(`- Screaming Frog: ${sfOutDir}`);
