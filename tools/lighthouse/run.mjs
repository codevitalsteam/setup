import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { config } from "../utils/configLoader.mjs";
import { routes } from "../utils/routesLoader.mjs";
import { scoreTo100, failIfBelow, failIfAbove, auditNumericValue, auditDisplayValue } from "./helpers/lighthouseHelpers.js";
import { startSpinner } from "../utils/spinner.mjs";
import { runAsyncCommand } from "../utils/runAsyncCommand.mjs";


const lighthouseRoutes = (
  process.env.LH_ROUTES ? process.env.LH_ROUTES.split(",") : routes.lighthouse
)
  .map((s) => s.trim())
  .filter(Boolean);

// Perform Lighthouse audits
console.log("🚦 Starting Lighthouse audits...");
console.log(`Using config: ${JSON.stringify(config.lighthouse)}`);
console.log(`Using routes: ${JSON.stringify(routes)}`);

const presets = config.lighthouse.devices;
const thresholds = config.lighthouse.thresholds;

const OUT_DIR = path.resolve("artifacts/lighthouse");
fs.mkdirSync(OUT_DIR, { recursive: true });

const server = null;

function cleanup(code = 0) {
  if (server) {
    server.kill("SIGTERM");
    process.exit(code);
  }
}

if (server) {
  process.on("SIGINT", () => cleanup(130));
  process.on("SIGTERM", () => cleanup(143));
}

// small wait for server
await new Promise((r) => setTimeout(r, 1200));

const failures = [];
for (const route of lighthouseRoutes) {
  const url = `${process.env.HOST}${
    route.startsWith("/") ? route : `/${route}`
  }`;
  const slugBase = route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_+/, "");

    for (const preset of presets) {
        const slug = `${slugBase}-${preset}`;
        const jsonPath = path.join(OUT_DIR, `${slug}.json`);

        const spin = startSpinner(`Lighthouse: ${route}`);

        try {
          // Need to add Chrome flags to run in some CI environments '...(chromePath ? [`--chrome-path=${chromePath}`] : []),'.
            await runAsyncCommand(
            "npx",
            [
                "lighthouse",
                url,
                `${preset == "desktop" ? "--preset=desktop" : ""}`,
                "--output=json",
                `--output-path=${jsonPath}`,
                "--quiet",
                "--only-categories=performance,accessibility,best-practices,seo",
                '--chrome-flags="--headless --no-sandbox"',
            ],
            process.cwd()
            );

            spin.succeed(`Lighthouse done (${preset}): ${route}`);
        } catch (e) {
            spin.fail(`Lighthouse failed (${preset}): ${route}`);
            throw e; // keeps your script failing properly
        }

        const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        const cats = report.categories || {};
        const scores = {
            performance: scoreTo100(cats.performance?.score),
            accessibility: scoreTo100(cats.accessibility?.score),
            bestPractices: scoreTo100(cats["best-practices"]?.score),
            seo: scoreTo100(cats.seo?.score),
        };

        console.log(` ${preset} Scores:`, scores);

        const audits = report.audits || {};

        const metrics = {
            fcpMs: auditNumericValue(audits, "first-contentful-paint"),
            lcpMs: auditNumericValue(audits, "largest-contentful-paint"),
            cls: auditNumericValue(audits, "cumulative-layout-shift"),
            inpMs: auditNumericValue(audits, "interaction-to-next-paint"),
            tbtMs: auditNumericValue(audits, "total-blocking-time"),
        };

        console.log(`${preset} Metrics:`, {
            fcp: auditDisplayValue(audits, "first-contentful-paint"),
            lcp: auditDisplayValue(audits, "largest-contentful-paint"),
            cls: auditDisplayValue(audits, "cumulative-layout-shift"),
            inp: auditDisplayValue(audits, "interaction-to-next-paint"),
            tbt: auditDisplayValue(audits, "total-blocking-time"),
        });

        const fialedMetrics = [];


        fialedMetrics.push(
            failIfBelow("SEO", scores.seo, thresholds.seo),
            failIfBelow("Perf", scores.performance, thresholds.performance),
            failIfBelow("A11y", scores.accessibility, thresholds.accessibility),
            failIfBelow("BP", scores.bestPractices, thresholds.bestPractices),
            failIfAbove("CLS", metrics.cls, thresholds.cls),
            failIfAbove("FCP", metrics.fcpMs, thresholds.fcpMs),
            failIfAbove("LCP", metrics.lcpMs, thresholds.lcpMs),
            failIfAbove("INP", metrics.inpMs, thresholds.inpMs),
            failIfAbove("TBT", metrics.tbtMs, thresholds.tbtMs)
        );
        
        failures.push({route: `${preset} ${route}`, failures: fialedMetrics.filter(Boolean)});
    }
}
const realFailures = failures.filter(Boolean);
if (realFailures.length) {
  console.error("Lighthouse gate failed:");
  for (const f of realFailures){
    if(f.failures) console.error(` - ${f.route}:`, f.failures);
  }
  if (server) cleanup(1);
}else{
    console.log("Lighthouse gate passed");
    if (server) cleanup(0);
}