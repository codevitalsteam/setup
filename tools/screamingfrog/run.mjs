import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { startSpinner } from "../utils/spinner.mjs";
import { runAsyncCommand } from "../utils/runAsyncCommand.mjs";

const sfOutDir = path.resolve("artifacts/screamingfrog");
fs.mkdirSync(sfOutDir, { recursive: true });

// Screaming Frog (headless crawl + exports)
console.log(`\nStarting Screaming Frog crawl of ${process.env.HOST}...`);
if (process.env.SF_LICENCE_KEY) {
  run(`screamingfrogseospider --licence "${process.env.SF_LICENCE_KEY}"`);
}

const spin = startSpinner(`Screaming Frog: ${process.env.HOST}`);

try {
  // Need to add Chrome flags to run in some CI environments '...(chromePath ? [`--chrome-path=${chromePath}`] : []),'.
    await runAsyncCommand(
      "npx",
      [
        "screamingfrogseospider",
        "--headless",
        `--crawl "${process.env.HOST}"`,
        `--user-agent "${process.env.USER_AGENT || "CodeVitalsBot/1.0"}"`,
        "--save-crawl",
        `--output-folder "${sfOutDir}"`,
        '--export-tabs "Internal:All Inlinks,Response Codes:Client Error (4xx),Redirect Chains,Directives"',
      ],
      process.cwd()
    );

    spin.succeed(`Screaming Frog done: ${process.env.HOST}`);
} catch (e) {
    spin.fail(`Screaming Frog failed: ${process.env.HOST}`);
    throw e; // keeps your script failing properly
}

